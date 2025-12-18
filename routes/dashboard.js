/**
 * Dashboard Routes
 *
 * GET /api/dashboard/stats - Estadísticas del dashboard
 */

const express = require('express');
const router = express.Router();
const db = require('../config/supabase');
const apiCounter = require('../modules/apiCounter');
const scheduler = require('../modules/tweetScheduler');

/**
 * GET /api/dashboard/stats
 * Obtener estadísticas para el dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // Obtener estadísticas de tweets
    const tweetStats = await db.getDashboardStats();

    // Obtener información del contador API
    const counterInfo = await apiCounter.getInfo();

    // Obtener estado del scheduler
    const schedulerStatus = scheduler.getStatus();

    // Obtener tweets publicados recientemente
    const { data: recentTweets } = await db.getTweets({
      estado: 'published',
      limit: 10,
      offset: 0
    });

    res.json({
      success: true,
      stats: {
        // Tweets
        pendingCount: tweetStats.pendingCount,
        publishedToday: tweetStats.publishedToday,
        nextScheduled: tweetStats.nextScheduled,
        recentTweets,

        // API Counter
        apiCalls: {
          month: counterInfo.month,
          calls_count: counterInfo.calls_count,
          monthly_limit: counterInfo.monthly_limit,
          remaining: counterInfo.remaining,
          percentage: counterInfo.percentage,
          is_warning: counterInfo.is_warning,
          is_critical: counterInfo.is_critical
        },

        // Scheduler
        scheduler: {
          isRunning: schedulerStatus.isRunning,
          lastRun: schedulerStatus.lastRun
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas del dashboard'
    });
  }
});

module.exports = router;
