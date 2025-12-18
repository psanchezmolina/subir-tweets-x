/**
 * Supabase Client y Funciones CRUD
 *
 * Este módulo maneja toda la interacción con la base de datos Supabase:
 * - Configuración del cliente
 * - CRUD para tweets
 * - CRUD para credenciales
 * - CRUD para contador API
 * - CRUD para logs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración del cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY deben estar definidas en .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==============================================================================
// FUNCIONES CRUD PARA TWEETS
// ==============================================================================

/**
 * Crear múltiples tweets desde un CSV
 * @param {Array} tweetsData - Array de objetos con los datos de los tweets
 * @returns {Object} - { success: boolean, count: number, error?: string }
 */
async function createTweets(tweetsData) {
  try {
    const { data, error } = await supabase
      .from('tweets')
      .insert(tweetsData)
      .select();

    if (error) throw error;

    return { success: true, count: data.length, data };
  } catch (error) {
    console.error('Error creating tweets:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener tweets pendientes que deban publicarse ahora
 * @returns {Array} - Array de tweets pendientes
 */
async function getTweetsDueForPublishing() {
  try {
    const { data, error } = await supabase
      .from('tweets')
      .select('*')
      .eq('estado', 'pending')
      .lte('fecha_publicacion', new Date().toISOString())
      .order('fecha_publicacion', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting due tweets:', error);
    return [];
  }
}

/**
 * Obtener todos los tweets con filtros opcionales
 * @param {Object} filters - { estado, limit, offset }
 * @returns {Object} - { data: Array, count: number }
 */
async function getTweets(filters = {}) {
  try {
    const { estado, limit = 50, offset = 0 } = filters;

    let query = supabase
      .from('tweets')
      .select('*', { count: 'exact' })
      .order('fecha_publicacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error getting tweets:', error);
    return { data: [], count: 0 };
  }
}

/**
 * Actualizar estado de un tweet
 * @param {string} tweetId - UUID del tweet
 * @param {string} estado - 'published' | 'failed'
 * @param {string} xTweetId - ID retornado por X API (opcional)
 * @param {string} errorMessage - Mensaje de error (opcional)
 */
async function updateTweetStatus(tweetId, estado, xTweetId = null, errorMessage = null) {
  try {
    const updateData = { estado };

    if (estado === 'published') {
      updateData.tweet_id = xTweetId;
      updateData.published_at = new Date().toISOString();
    }

    if (estado === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('tweets')
      .update(updateData)
      .eq('id', tweetId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating tweet status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener tweets publicados hoy
 * @returns {number} - Cantidad de tweets publicados hoy
 */
async function getTweetsPublishedToday() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'published')
      .gte('published_at', today.toISOString());

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Error getting tweets published today:', error);
    return 0;
  }
}

/**
 * Obtener estadísticas del dashboard
 * @returns {Object} - { pendingCount, publishedToday, nextScheduled }
 */
async function getDashboardStats() {
  try {
    // Tweets pendientes
    const { count: pendingCount } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pending');

    // Tweets publicados hoy
    const publishedToday = await getTweetsPublishedToday();

    // Próximo tweet programado
    const { data: nextTweets } = await supabase
      .from('tweets')
      .select('fecha_publicacion')
      .eq('estado', 'pending')
      .order('fecha_publicacion', { ascending: true })
      .limit(1);

    const nextScheduled = nextTweets && nextTweets[0]
      ? nextTweets[0].fecha_publicacion
      : null;

    return {
      pendingCount: pendingCount || 0,
      publishedToday,
      nextScheduled
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return { pendingCount: 0, publishedToday: 0, nextScheduled: null };
  }
}

// ==============================================================================
// FUNCIONES CRUD PARA CREDENCIALES
// ==============================================================================

/**
 * Guardar o actualizar credenciales de X API
 * @param {Object} credentials - { api_key, api_secret, access_token, access_token_secret }
 * @returns {Object} - { success: boolean, error?: string }
 */
async function saveCredentials(credentials) {
  try {
    // Verificar si ya existen credenciales activas
    const { data: existing } = await supabase
      .from('credentials')
      .select('id')
      .eq('is_active', true)
      .single();

    if (existing) {
      // Actualizar credenciales existentes
      const { error } = await supabase
        .from('credentials')
        .update({
          ...credentials,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insertar nuevas credenciales
      const { error } = await supabase
        .from('credentials')
        .insert(credentials);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving credentials:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener credenciales activas
 * @returns {Object|null} - Credenciales o null si no existen
 */
async function getCredentials() {
  try {
    const { data, error } = await supabase
      .from('credentials')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting credentials:', error);
    return null;
  }
}

// ==============================================================================
// FUNCIONES CRUD PARA CONTADOR API
// ==============================================================================

/**
 * Obtener o crear contador para el mes actual
 * @returns {Object} - { month, calls_count, daily_counts }
 */
async function getOrCreateCounter() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Intentar obtener contador existente
    const { data, error } = await supabase
      .from('api_counter')
      .select('*')
      .eq('month', currentMonth)
      .single();

    if (error && error.code === 'PGRST116') {
      // No existe, crear nuevo
      const { data: newCounter, error: insertError } = await supabase
        .from('api_counter')
        .insert({
          month: currentMonth,
          calls_count: 0,
          daily_counts: {}
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return newCounter;
    }

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting/creating counter:', error);
    return { month: '', calls_count: 0, daily_counts: {} };
  }
}

/**
 * Incrementar contador de API
 * @returns {Object} - { success: boolean, calls_count: number }
 */
async function incrementApiCounter() {
  try {
    const counter = await getOrCreateCounter();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Actualizar contador mensual y diario
    const dailyCounts = counter.daily_counts || {};
    dailyCounts[today] = (dailyCounts[today] || 0) + 1;

    const { data, error } = await supabase
      .from('api_counter')
      .update({
        calls_count: counter.calls_count + 1,
        daily_counts: dailyCounts
      })
      .eq('month', counter.month)
      .select()
      .single();

    if (error) throw error;

    return { success: true, calls_count: data.calls_count };
  } catch (error) {
    console.error('Error incrementing API counter:', error);
    return { success: false, calls_count: 0 };
  }
}

/**
 * Verificar si se puede hacer una llamada API (límite 100/mes)
 * @returns {boolean} - true si se puede hacer la llamada
 */
async function canMakeApiCall() {
  try {
    const counter = await getOrCreateCounter();
    return counter.calls_count < 100; // Límite free tier
  } catch (error) {
    console.error('Error checking API limit:', error);
    return false;
  }
}

// ==============================================================================
// FUNCIONES CRUD PARA LOGS
// ==============================================================================

/**
 * Crear un log
 * @param {string} level - 'info' | 'warning' | 'error'
 * @param {string} message - Mensaje del log
 * @param {Object} context - Datos adicionales (opcional)
 */
async function createLog(level, message, context = {}) {
  try {
    const { error } = await supabase
      .from('logs')
      .insert({
        level,
        message,
        context
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error creating log:', error);
  }
}

/**
 * Obtener logs recientes
 * @param {Object} filters - { level, limit }
 * @returns {Array} - Array de logs
 */
async function getLogs(filters = {}) {
  try {
    const { level, limit = 100 } = filters;

    let query = supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (level) {
      query = query.eq('level', level);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting logs:', error);
    return [];
  }
}

// ==============================================================================
// EXPORTS
// ==============================================================================

module.exports = {
  supabase,

  // Tweets
  createTweets,
  getTweetsDueForPublishing,
  getTweets,
  updateTweetStatus,
  getTweetsPublishedToday,
  getDashboardStats,

  // Credentials
  saveCredentials,
  getCredentials,

  // API Counter
  getOrCreateCounter,
  incrementApiCounter,
  canMakeApiCall,

  // Logs
  createLog,
  getLogs
};
