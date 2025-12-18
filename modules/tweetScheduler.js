/**
 * Tweet Scheduler
 *
 * Lógica principal del cron job:
 * - Obtiene tweets pendientes
 * - Agrupa por thread_id
 * - Publica secuencialmente con delays
 * - Maneja errores y límites de API
 */

const db = require('../config/supabase');
const apiCounter = require('./apiCounter');
const TwitterClient = require('./twitterClient');
const MediaUploader = require('./mediaUploader');

class TweetScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
  }

  /**
   * Ejecutar el scheduler (llamado por cron)
   */
  async run() {
    if (this.isRunning) {
      console.log('⏭️  Scheduler ya está corriendo, saltando ejecución');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    console.log('\n🚀 Iniciando scheduler de tweets...');
    console.log(`Hora: ${this.lastRun.toLocaleString()}`);

    try {
      // 1. Verificar que existan credenciales
      const credentials = await db.getCredentials();

      if (!credentials) {
        console.log('⚠️  No hay credenciales configuradas. Saltando ejecución.');
        await db.createLog('warning', 'Scheduler ejecutado sin credenciales configuradas');
        return;
      }

      // 2. Obtener tweets pendientes
      const pendingTweets = await db.getTweetsDueForPublishing();

      if (pendingTweets.length === 0) {
        console.log('✓ No hay tweets pendientes para publicar');
        return;
      }

      console.log(`📋 ${pendingTweets.length} tweets pendientes encontrados`);

      // 3. Verificar límites antes de empezar
      const limitCheck = await apiCounter.canMakeCall();

      if (!limitCheck.allowed) {
        console.log(`⛔ ${limitCheck.reason}`);
        await db.createLog('warning', `Límites API alcanzados: ${limitCheck.reason}`);
        return;
      }

      // 4. Inicializar cliente de Twitter
      const twitterClient = new TwitterClient(credentials);
      const mediaUploader = new MediaUploader(twitterClient);

      // 5. Agrupar tweets por thread
      const threads = this.groupByThread(pendingTweets);

      console.log(`🧵 ${Object.keys(threads).length} threads/tweets individuales a publicar`);

      // 6. Publicar threads
      const results = await this.publishThreads(threads, twitterClient, mediaUploader);

      // 7. Resumen
      console.log('\n📊 Resumen de publicación:');
      console.log(`  ✓ Exitosos: ${results.successful}`);
      console.log(`  ✗ Fallidos: ${results.failed}`);
      console.log(`  ⏭️  Saltados: ${results.skipped}`);

      const counterInfo = await apiCounter.getInfo();
      console.log(`  📈 Uso API: ${counterInfo.calls_count}/${counterInfo.monthly_limit} (${counterInfo.percentage}%)`);

      await db.createLog('info', `Scheduler completado: ${results.successful} exitosos, ${results.failed} fallidos`, {
        results
      });

    } catch (error) {
      console.error('❌ Error fatal en scheduler:', error);
      await db.createLog('error', `Error en scheduler: ${error.message}`, {
        error: error.stack
      });
    } finally {
      this.isRunning = false;
      console.log('🏁 Scheduler finalizado\n');
    }
  }

  /**
   * Agrupar tweets por thread_id
   * @param {Array} tweets - Array de tweets
   * @returns {Object} - { thread_id: [tweets] }
   */
  groupByThread(tweets) {
    const threads = {};

    tweets.forEach(tweet => {
      const threadKey = tweet.thread_id || `single_${tweet.id}`;

      if (!threads[threadKey]) {
        threads[threadKey] = [];
      }

      threads[threadKey].push(tweet);
    });

    // Ordenar tweets dentro de cada thread por fecha
    Object.keys(threads).forEach(key => {
      threads[key].sort((a, b) =>
        new Date(a.fecha_publicacion) - new Date(b.fecha_publicacion)
      );
    });

    return threads;
  }

  /**
   * Publicar threads secuencialmente
   * @param {Object} threads - Threads agrupados
   * @param {TwitterClient} twitterClient - Cliente de Twitter
   * @param {MediaUploader} mediaUploader - Uploader de imágenes
   * @returns {Object} - Estadísticas de publicación
   */
  async publishThreads(threads, twitterClient, mediaUploader) {
    const results = {
      successful: 0,
      failed: 0,
      skipped: 0
    };

    const threadKeys = Object.keys(threads);

    for (let i = 0; i < threadKeys.length; i++) {
      const threadKey = threadKeys[i];
      const threadTweets = threads[threadKey];

      const isThread = threadTweets.length > 1;
      const threadName = isThread ? `Thread "${threadKey}"` : 'Tweet individual';

      console.log(`\n📝 Publicando ${threadName} (${threadTweets.length} tweet${isThread ? 's' : ''})...`);

      let previousTweetId = null;

      for (let j = 0; j < threadTweets.length; j++) {
        const tweet = threadTweets[j];

        try {
          // Verificar límite antes de cada publicación
          const limitCheck = await apiCounter.canMakeCall();

          if (!limitCheck.allowed) {
            console.log(`⏭️  Saltando resto de tweets: ${limitCheck.reason}`);
            results.skipped += (threadTweets.length - j);
            break; // Salir del thread actual
          }

          // Subir imagen si existe
          let mediaId = null;
          if (tweet.imagen_url) {
            try {
              console.log(`  📸 Subiendo imagen...`);
              mediaId = await mediaUploader.upload(tweet.imagen_url);
            } catch (imgError) {
              console.error(`  ⚠️  Error subiendo imagen: ${imgError.message}`);
              // Continuar sin imagen
            }
          }

          // Publicar tweet
          const tweetText = tweet.texto;
          const displayText = tweetText.length > 50
            ? tweetText.substring(0, 50) + '...'
            : tweetText;

          console.log(`  🐦 Publicando: "${displayText}"`);

          const tweetId = await twitterClient.postTweet({
            text: tweetText,
            reply_to: previousTweetId,
            media_ids: mediaId ? [mediaId] : []
          });

          // Actualizar en BD
          await db.updateTweetStatus(tweet.id, 'published', tweetId);

          // Incrementar contador
          await apiCounter.increment();

          console.log(`  ✓ Publicado exitosamente (ID: ${tweetId})`);

          results.successful++;
          previousTweetId = tweetId;

          // Delay entre tweets del mismo thread
          if (j < threadTweets.length - 1) {
            console.log(`  ⏳ Esperando 2 segundos...`);
            await this.sleep(2000);
          }

        } catch (error) {
          console.error(`  ❌ Error publicando tweet: ${error.message}`);

          // Marcar como fallido
          await db.updateTweetStatus(tweet.id, 'failed', null, error.message);

          results.failed++;

          // Si falla un tweet en un thread, no continuar con el resto
          if (isThread) {
            console.log(`  ⚠️  Abortando resto del thread por error`);
            results.skipped += (threadTweets.length - j - 1);
            break;
          }
        }
      }

      // Delay entre threads diferentes
      if (i < threadKeys.length - 1) {
        console.log(`⏳ Esperando 5 segundos antes del siguiente thread...`);
        await this.sleep(5000);
      }
    }

    return results;
  }

  /**
   * Sleep helper
   * @param {number} ms - Milisegundos
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener estado del scheduler
   * @returns {Object} - { isRunning, lastRun }
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun
    };
  }
}

module.exports = new TweetScheduler();
