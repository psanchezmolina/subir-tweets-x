/**
 * Tweets Routes
 *
 * GET /api/tweets - Listar tweets con filtros
 * GET /api/tweets/:id - Obtener un tweet específico
 */

const express = require('express');
const router = express.Router();
const db = require('../config/supabase');
const apiCounter = require('../modules/apiCounter');
const TwitterClient = require('../modules/twitterClient');
const MediaUploader = require('../modules/mediaUploader');

/**
 * GET /api/tweets
 * Listar tweets con filtros opcionales
 * Query params: estado, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { estado, limit, offset } = req.query;

    const filters = {
      estado,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    };

    // Validar estado
    if (estado && !['pending', 'published', 'failed'].includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido. Debe ser: pending, published o failed'
      });
    }

    const result = await db.getTweets(filters);

    res.json({
      success: true,
      data: result.data,
      total: result.count,
      filters: {
        estado: filters.estado || 'all',
        limit: filters.limit,
        offset: filters.offset
      }
    });
  } catch (error) {
    console.error('Error getting tweets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tweets'
    });
  }
});

/**
 * GET /api/tweets/stats
 * Obtener estadísticas de tweets
 */
router.get('/stats', async (req, res) => {
  try {
    const { data: allTweets } = await db.getTweets({ limit: 10000 });

    // Contar por estado
    const stats = {
      total: allTweets.length,
      pending: allTweets.filter(t => t.estado === 'pending').length,
      published: allTweets.filter(t => t.estado === 'published').length,
      failed: allTweets.filter(t => t.estado === 'failed').length
    };

    // Contar threads
    const threadIds = new Set(
      allTweets
        .filter(t => t.thread_id)
        .map(t => t.thread_id)
    );
    stats.threads = threadIds.size;
    stats.individualTweets = stats.total - allTweets.filter(t => t.thread_id).length;

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting tweet stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

/**
 * GET /api/tweets/:id
 * Obtener un tweet específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db.supabase
      .from('tweets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Tweet no encontrado'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error getting tweet:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tweet'
    });
  }
});

/**
 * POST /api/tweets/:id/publish
 * Publicar un tweet manualmente (forzar publicación inmediata)
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener el tweet
    const { data: tweet, error: fetchError } = await db.supabase
      .from('tweets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Tweet no encontrado'
        });
      }
      throw fetchError;
    }

    // 2. Verificar que esté pendiente
    if (tweet.estado !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `No se puede publicar. El tweet ya está en estado: ${tweet.estado}`
      });
    }

    // 3. Verificar credenciales
    const credentials = await db.getCredentials();
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'No hay credenciales de X API configuradas'
      });
    }

    // 4. Verificar límites API
    const limitCheck = await apiCounter.canMakeCall();
    if (!limitCheck.allowed) {
      return res.status(400).json({
        success: false,
        error: limitCheck.reason
      });
    }

    // 5. Inicializar cliente
    const twitterClient = new TwitterClient(credentials);
    const mediaUploader = new MediaUploader(twitterClient);

    // 6. Subir imagen si existe
    let mediaId = null;
    if (tweet.imagen_url) {
      try {
        mediaId = await mediaUploader.upload(tweet.imagen_url);
      } catch (imgError) {
        console.error('Error subiendo imagen:', imgError);
        // Continuar sin imagen
      }
    }

    // 7. Publicar tweet
    const tweetId = await twitterClient.postTweet({
      text: tweet.texto,
      reply_to: null, // No soporta reply manual por ahora
      media_ids: mediaId ? [mediaId] : []
    });

    // 8. Actualizar en BD
    await db.updateTweetStatus(tweet.id, 'published', tweetId);

    // 9. Incrementar contador
    await apiCounter.increment();

    // 10. Log
    await db.createLog('info', `Tweet publicado manualmente: ${tweetId}`, {
      tweet_id: tweet.id,
      x_tweet_id: tweetId
    });

    res.json({
      success: true,
      message: 'Tweet publicado exitosamente',
      data: {
        tweet_id: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`
      }
    });

  } catch (error) {
    console.error('Error publishing tweet manually:', error);

    // Marcar como fallido
    if (req.params.id) {
      await db.updateTweetStatus(req.params.id, 'failed', null, error.message);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error al publicar tweet'
    });
  }
});

module.exports = router;
