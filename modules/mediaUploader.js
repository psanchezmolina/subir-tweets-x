/**
 * Media Uploader
 *
 * Descarga imágenes desde URLs y las sube a Twitter API
 */

const axios = require('axios');

class MediaUploader {
  /**
   * Constructor
   * @param {TwitterClient} twitterClient - Instancia del cliente de Twitter
   */
  constructor(twitterClient) {
    if (!twitterClient) {
      throw new Error('Se requiere una instancia de TwitterClient');
    }
    this.twitterClient = twitterClient;
  }

  /**
   * Descargar y subir imagen a Twitter
   * @param {string} imageUrl - URL de la imagen
   * @returns {string} - Media ID para usar en tweets
   */
  async upload(imageUrl) {
    try {
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('URL de imagen inválida');
      }

      // Validar que sea una URL válida
      let parsedUrl;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        throw new Error(`URL inválida: ${imageUrl}`);
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Solo se permiten URLs HTTP/HTTPS');
      }

      console.log(`Descargando imagen: ${imageUrl}`);

      // Descargar imagen
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 segundos timeout
        maxContentLength: 5 * 1024 * 1024, // Máx 5MB
        headers: {
          'User-Agent': 'TweetScheduler/1.0'
        }
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('La imagen descargada está vacía');
      }

      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'image/jpeg';

      // Validar tipo MIME
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validMimeTypes.includes(mimeType.toLowerCase())) {
        throw new Error(`Tipo de imagen no soportado: ${mimeType}. Soportados: JPG, PNG, GIF, WEBP`);
      }

      console.log(`✓ Imagen descargada: ${(buffer.length / 1024).toFixed(2)} KB (${mimeType})`);

      // Subir a Twitter
      console.log('Subiendo imagen a X API...');
      const mediaId = await this.twitterClient.uploadImage(buffer, mimeType);

      console.log(`✓ Imagen subida exitosamente. Media ID: ${mediaId}`);

      return mediaId;
    } catch (error) {
      console.error('Error uploading media:', error);

      // Mejorar mensajes de error
      if (error.code === 'ENOTFOUND') {
        throw new Error(`No se pudo resolver el dominio: ${error.hostname}`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Timeout al descargar la imagen - URL muy lenta o inaccesible');
      } else if (error.response && error.response.status === 404) {
        throw new Error('Imagen no encontrada (404) en la URL proporcionada');
      } else if (error.response && error.response.status === 403) {
        throw new Error('Acceso denegado (403) a la URL de la imagen');
      } else if (error.message && error.message.includes('maxContentLength')) {
        throw new Error('La imagen excede el tamaño máximo de 5MB');
      } else if (error.message) {
        throw error;
      } else {
        throw new Error('Error desconocido al procesar la imagen');
      }
    }
  }

  /**
   * Validar si una URL es accesible (HEAD request)
   * @param {string} imageUrl - URL a validar
   * @returns {boolean} - true si es accesible
   */
  async validateUrl(imageUrl) {
    try {
      const response = await axios.head(imageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'TweetScheduler/1.0'
        }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

module.exports = MediaUploader;
