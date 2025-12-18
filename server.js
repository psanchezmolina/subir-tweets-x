/**
 * Tweet Scheduler - Server Principal
 *
 * Servidor Express con:
 * - API REST para gestión de tweets
 * - Autenticación con sesiones
 * - Cron job para publicación automática
 * - Servir archivos estáticos del frontend
 */

// Cargar variables de entorno desde .env (solo en desarrollo)
// En producción (Docker/Easypanel), las variables se inyectan directamente
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');

// Modules
const auth = require('./modules/auth');
const scheduler = require('./modules/tweetScheduler');

// Routes
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const tweetsRoutes = require('./routes/tweets');

// ==============================================================================
// CONFIGURACIÓN
// ==============================================================================

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==============================================================================
// MIDDLEWARES
// ==============================================================================

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Permite event handlers inline (onclick, etc.)
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"], // Permitir source maps de CDN
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  }
}));

// CORS
if (NODE_ENV === 'development') {
  app.use(cors());
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-por-defecto-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // HTTPS en producción
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: 'Demasiadas requests desde esta IP, por favor intenta más tarde'
});
app.use('/api/', limiter);

// Rate limiting específico para upload (más restrictivo)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máx 10 uploads por hora
  message: 'Demasiados uploads. Límite: 10 por hora'
});
app.use('/api/upload', uploadLimiter);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================================
// RUTAS DE AUTENTICACIÓN
// ==============================================================================

/**
 * GET /api/auth/status
 * Verificar si está autenticado
 */
app.get('/api/auth/status', auth.checkAuth);

/**
 * POST /api/auth/login
 * Login
 */
app.post('/api/auth/login', auth.login);

/**
 * POST /api/auth/logout
 * Logout
 */
app.post('/api/auth/logout', auth.logout);

// ==============================================================================
// RUTAS DE API (PROTEGIDAS)
// ==============================================================================

// Registrar rutas protegidas (requieren autenticación)
app.use('/api/dashboard', auth.requireAuth, dashboardRoutes);
app.use('/api/settings', auth.requireAuth, settingsRoutes);
app.use('/api/upload', auth.requireAuth, uploadRoutes);
app.use('/api/tweets', auth.requireAuth, tweetsRoutes);

// ==============================================================================
// RUTA PRINCIPAL (FRONTEND)
// ==============================================================================

/**
 * GET /
 * Servir aplicación principal
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * GET /login
 * Página de login
 */
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================================
// MANEJO DE ERRORES
// ==============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Error handler general
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);

  // Error de Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo excede el tamaño máximo permitido (5MB)'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

// ==============================================================================
// CRON JOB - SCHEDULER
// ==============================================================================

// Configurar cron job para ejecutar scheduler
// Ejecuta cada 15 minutos por defecto
// Para testing, cambiar CRON_SCHEDULE en .env a: * * * * * (cada minuto)

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';

console.log(`\n⏰ Configurando cron job: ${CRON_SCHEDULE}`);

cron.schedule(CRON_SCHEDULE, async () => {
  try {
    await scheduler.run();
  } catch (error) {
    console.error('Error ejecutando cron job:', error);
  }
}, {
  timezone: 'UTC' // Usar UTC para evitar problemas con horarios de verano
});

// Ejecutar scheduler al iniciar (opcional, comentar si no se desea)
if (NODE_ENV === 'development') {
  console.log('🔧 Modo desarrollo: ejecutando scheduler al iniciar...');
  setTimeout(async () => {
    try {
      await scheduler.run();
    } catch (error) {
      console.error('Error en scheduler inicial:', error);
    }
  }, 5000); // Esperar 5 segundos después del inicio
}

// ==============================================================================
// INICIAR SERVIDOR
// ==============================================================================

app.listen(PORT, () => {
  console.log('\n🚀 ==============================================');
  console.log(`🚀  Tweet Scheduler Server`);
  console.log(`🚀 ==============================================`);
  console.log(`🚀  Entorno: ${NODE_ENV}`);
  console.log(`🚀  Puerto: ${PORT}`);
  console.log(`🚀  URL: http://localhost:${PORT}`);
  console.log(`🚀  Cron: ${CRON_SCHEDULE}`);
  console.log(`🚀 ==============================================\n`);

  // Verificar variables de entorno críticas
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  WARNING: Variables SUPABASE_URL y/o SUPABASE_SERVICE_KEY no configuradas');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'secret-por-defecto-cambiar-en-produccion') {
    console.warn('⚠️  WARNING: SESSION_SECRET no configurado o usando valor por defecto');
  }

  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  WARNING: ADMIN_PASSWORD no configurado');
  }
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT recibido, cerrando servidor...');
  process.exit(0);
});
