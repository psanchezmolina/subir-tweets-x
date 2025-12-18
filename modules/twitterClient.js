/**
 * Twitter/X API Client
 *
 * Maneja toda la interacción con la API de X (Twitter):
 * - Autenticación OAuth 1.0a
 * - Publicación de tweets
 * - Publicación de threads con reply_to
 * - Upload de imágenes
 */

const { TwitterApi } = require('twitter-api-v2');

class TwitterClient {
  /**
   * Constructor del cliente
   * @param {Object} credentials - { api_key, api_secret, access_token, access_token_secret }
   */
  constructor(credentials) {
    if (!credentials || !credentials.api_key || !credentials.api_secret ||
        !credentials.access_token || !credentials.access_token_secret) {
      throw new Error('Faltan credenciales de Twitter API');
    }

    this.client = new TwitterApi({
      appKey: credentials.api_key,
      appSecret: credentials.api_secret,
      accessToken: credentials.access_token,
      accessSecret: credentials.access_token_secret,
    });

    // Cliente con permisos de lectura/escritura
    this.rwClient = this.client.readWrite;
  }

  /**
   * Publicar un tweet
   * @param {Object} options - { text, reply_to, media_ids }
   * @returns {string} - ID del tweet publicado
   */
  async postTweet({ text, reply_to = null, media_ids = [] }) {
    try {
      if (!text || text.trim() === '') {
        throw new Error('El texto del tweet no puede estar vacío');
      }

      if (text.length > 280) {
        throw new Error(`El tweet excede 280 caracteres (actual: ${text.length})`);
      }

      const payload = { text: text.trim() };

      // Agregar reply_to si es un thread
      if (reply_to) {
        payload.reply = {
          in_reply_to_tweet_id: reply_to
        };
      }

      // Agregar imágenes si existen
      if (media_ids && media_ids.length > 0) {
        payload.media = {
          media_ids: media_ids.filter(id => id !== null)
        };
      }

      // Publicar tweet
      const response = await this.rwClient.v2.tweet(payload);

      if (!response.data || !response.data.id) {
        throw new Error('La API de X no retornó un ID de tweet');
      }

      return response.data.id;
    } catch (error) {
      console.error('Error posting tweet:', error);

      // Mejorar mensajes de error específicos de Twitter API
      if (error.code === 403) {
        throw new Error('Acceso denegado - verifica permisos de la app (debe tener Read and Write)');
      } else if (error.code === 401) {
        throw new Error('Credenciales inválidas - verifica tu API Key y Access Token');
      } else if (error.code === 429) {
        throw new Error('Rate limit excedido - espera antes de intentar nuevamente');
      } else if (error.data && error.data.detail) {
        throw new Error(`Error de X API: ${error.data.detail}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Subir una imagen a Twitter
   * @param {Buffer} imageBuffer - Buffer de la imagen
   * @param {string} mimeType - Tipo MIME (image/jpeg, image/png, etc.)
   * @returns {string} - Media ID para usar en tweets
   */
  async uploadImage(imageBuffer, mimeType = 'image/jpeg') {
    try {
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('El buffer de imagen está vacío');
      }

      // Verificar tamaño (máx 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (imageBuffer.length > maxSize) {
        throw new Error(`La imagen excede el tamaño máximo (5MB). Tamaño actual: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      }

      // Subir usando v1 API (media endpoint solo está en v1.1)
      const mediaId = await this.client.v1.uploadMedia(imageBuffer, {
        mimeType: mimeType,
        target: 'tweet'
      });

      return mediaId;
    } catch (error) {
      console.error('Error uploading image:', error);

      if (error.code === 400 && error.message.includes('media type')) {
        throw new Error('Formato de imagen no soportado - usa JPG, PNG, GIF o WEBP');
      }

      throw error;
    }
  }

  /**
   * Verificar que las credenciales funcionen
   * @returns {Object} - Información del usuario autenticado
   */
  async testConnection() {
    try {
      const user = await this.rwClient.v2.me();

      if (!user || !user.data) {
        throw new Error('No se pudo obtener información del usuario');
      }

      return {
        success: true,
        user: {
          id: user.data.id,
          name: user.data.name,
          username: user.data.username
        }
      };
    } catch (error) {
      console.error('Error testing connection:', error);

      let message = 'Error al conectar con X API';

      if (error.code === 401) {
        message = 'Credenciales inválidas - verifica tu API Key y Access Token';
      } else if (error.code === 403) {
        message = 'Acceso denegado - verifica los permisos de tu aplicación';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Obtener información del límite de rate
   * @returns {Object} - Rate limit info
   */
  async getRateLimitStatus() {
    try {
      const rateLimit = await this.client.v2.rateLimits();
      return rateLimit;
    } catch (error) {
      console.error('Error getting rate limit:', error);
      return null;
    }
  }
}

module.exports = TwitterClient;
