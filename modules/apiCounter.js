/**
 * API Counter Module
 *
 * Wrapper alrededor de las funciones de Supabase para el contador API
 * Agrega lógica adicional de negocio y validaciones
 */

const db = require('../config/supabase');

class APICounter {
  constructor() {
    this.monthlyLimit = 100; // Límite free tier de X API
    this.dailyLimit = 15; // Límite diario conservador (real es ~17)
  }

  /**
   * Obtener información del contador actual
   * @returns {Object} - { month, calls_count, daily_counts, remaining, percentage }
   */
  async getInfo() {
    try {
      const counter = await db.getOrCreateCounter();

      const remaining = this.monthlyLimit - counter.calls_count;
      const percentage = Math.round((counter.calls_count / this.monthlyLimit) * 100);

      return {
        month: counter.month,
        calls_count: counter.calls_count,
        daily_counts: counter.daily_counts || {},
        monthly_limit: this.monthlyLimit,
        remaining,
        percentage,
        is_warning: percentage >= 80,
        is_critical: percentage >= 95
      };
    } catch (error) {
      console.error('Error getting counter info:', error);
      return {
        month: '',
        calls_count: 0,
        daily_counts: {},
        monthly_limit: this.monthlyLimit,
        remaining: this.monthlyLimit,
        percentage: 0,
        is_warning: false,
        is_critical: false
      };
    }
  }

  /**
   * Verificar si se puede hacer una llamada (validar límite mensual y diario)
   * @returns {Object} - { allowed: boolean, reason?: string }
   */
  async canMakeCall() {
    try {
      // Verificar límite mensual
      const canMake = await db.canMakeApiCall();

      if (!canMake) {
        return {
          allowed: false,
          reason: `Límite mensual alcanzado (${this.monthlyLimit} posts/mes). Reinicio: próximo mes`
        };
      }

      // Verificar límite diario
      const counter = await db.getOrCreateCounter();
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const dailyCounts = counter.daily_counts || {};
      const todayCount = dailyCounts[today] || 0;

      if (todayCount >= this.dailyLimit) {
        return {
          allowed: false,
          reason: `Límite diario alcanzado (${this.dailyLimit} posts/día). Reinicio: mañana`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking API limit:', error);
      return {
        allowed: false,
        reason: 'Error al verificar límites de API'
      };
    }
  }

  /**
   * Incrementar contador
   * @returns {Object} - { success: boolean, calls_count: number }
   */
  async increment() {
    try {
      return await db.incrementApiCounter();
    } catch (error) {
      console.error('Error incrementing counter:', error);
      return { success: false, calls_count: 0 };
    }
  }

  /**
   * Obtener llamadas realizadas hoy
   * @returns {number} - Cantidad de llamadas hoy
   */
  async getCallsToday() {
    try {
      const counter = await db.getOrCreateCounter();
      const today = new Date().toISOString().slice(0, 10);
      const dailyCounts = counter.daily_counts || {};
      return dailyCounts[today] || 0;
    } catch (error) {
      console.error('Error getting calls today:', error);
      return 0;
    }
  }

  /**
   * Obtener llamadas restantes para hoy
   * @returns {number} - Llamadas restantes hoy
   */
  async getRemainingCallsToday() {
    const callsToday = await this.getCallsToday();
    return Math.max(0, this.dailyLimit - callsToday);
  }

  /**
   * Obtener llamadas restantes para el mes
   * @returns {number} - Llamadas restantes este mes
   */
  async getRemainingCallsMonth() {
    const info = await this.getInfo();
    return info.remaining;
  }

  /**
   * Resetear contador (SOLO PARA TESTING)
   * @returns {Object} - { success: boolean }
   */
  async reset() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const { error } = await db.supabase
        .from('api_counter')
        .update({
          calls_count: 0,
          daily_counts: {},
          last_reset: new Date().toISOString()
        })
        .eq('month', currentMonth);

      if (error) throw error;

      console.log('⚠️  Contador API reseteado');

      return { success: true };
    } catch (error) {
      console.error('Error resetting counter:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new APICounter();
