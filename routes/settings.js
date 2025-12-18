/**
 * Settings Routes
 *
 * POST /api/settings/credentials - Guardar credenciales de X API
 * GET /api/settings/credentials - Obtener credenciales (parciales)
 * POST /api/settings/test-connection - Probar conexión con X API
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/supabase');
const TwitterClient = require('../modules/twitterClient');

/**
 * POST /api/settings/credentials
 * Guardar credenciales de X API
 */
router.post('/credentials', async (req, res) => {
  try {
    const { api_key, api_secret, access_token, access_token_secret } = req.body;

    // Validar que todos los campos estén presentes
    if (!api_key || !api_secret || !access_token || !access_token_secret) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son obligatorios'
      });
    }

    // Guardar en base de datos (en texto plano para desarrollo)
    // TODO: En producción, usar encriptación AES reversible
    const result = await db.saveCredentials({
      api_key,
      api_secret, // Guardado en texto plano
      access_token,
      access_token_secret // Guardado en texto plano
    });

    if (!result.success) {
      throw new Error(result.error || 'Error al guardar credenciales');
    }

    await db.createLog('info', 'Credenciales de X API actualizadas');

    res.json({
      success: true,
      message: 'Credenciales guardadas exitosamente'
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al guardar credenciales'
    });
  }
});

/**
 * GET /api/settings/credentials
 * Obtener credenciales (solo últimos 4 caracteres por seguridad)
 */
router.get('/credentials', async (req, res) => {
  try {
    const credentials = await db.getCredentials();

    if (!credentials) {
      return res.json({
        success: true,
        exists: false,
        credentials: null
      });
    }

    // Retornar solo últimos 4 caracteres por seguridad
    const maskString = (str) => {
      if (!str || str.length < 4) return '****';
      return '*'.repeat(str.length - 4) + str.slice(-4);
    };

    res.json({
      success: true,
      exists: true,
      credentials: {
        api_key: maskString(credentials.api_key),
        api_secret: maskString(credentials.api_secret),
        access_token: maskString(credentials.access_token),
        access_token_secret: maskString(credentials.access_token_secret),
        updated_at: credentials.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener credenciales'
    });
  }
});

/**
 * POST /api/settings/test-connection
 * Probar conexión con X API usando credenciales guardadas
 */
router.post('/test-connection', async (req, res) => {
  try {
    // Primero intentar obtener credenciales del body (formulario)
    let { api_key, api_secret, access_token, access_token_secret } = req.body;

    // Si no vienen en el body, intentar obtenerlas de la BD
    if (!api_key || !api_secret || !access_token || !access_token_secret) {
      const credentials = await db.getCredentials();

      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: 'No hay credenciales configuradas. Por favor, llena el formulario.'
        });
      }

      // Usar credenciales de la BD
      api_key = credentials.api_key;
      api_secret = credentials.api_secret;
      access_token = credentials.access_token;
      access_token_secret = credentials.access_token_secret;
    }

    const twitterClient = new TwitterClient({
      api_key,
      api_secret,
      access_token,
      access_token_secret
    });

    const testResult = await twitterClient.testConnection();

    if (testResult.success) {
      await db.createLog('info', `Conexión exitosa con X API para usuario @${testResult.user.username}`);
    }

    res.json(testResult);
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al probar conexión'
    });
  }
});

module.exports = router;
