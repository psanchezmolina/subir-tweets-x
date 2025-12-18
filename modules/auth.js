/**
 * Authentication Middleware
 *
 * Sistema simple de autenticación con sesiones
 * Usa un password único para proteger la aplicación
 */

const bcrypt = require('bcrypt');

/**
 * Middleware de autenticación
 * Verifica si el usuario tiene una sesión válida
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }

  // Si es una llamada API, retornar JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      error: 'No autenticado. Por favor inicia sesión.'
    });
  }

  // Si es navegación web, redirigir a login
  res.redirect('/login');
}

/**
 * Middleware opcional de autenticación
 * Permite pasar sin autenticación pero establece req.isAuthenticated
 */
function optionalAuth(req, res, next) {
  req.isAuthenticated = !!(req.session && req.session.authenticated);
  next();
}

/**
 * Verificar password contra el hash almacenado en .env
 * @param {string} password - Password en texto plano
 * @returns {boolean}
 */
async function verifyPassword(password) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('⚠️  ADMIN_PASSWORD no está configurado en .env');
      return false;
    }

    // Si el password en .env no es un hash bcrypt, comparar directamente (SOLO PARA DESARROLLO)
    if (!adminPassword.startsWith('$2b$') && !adminPassword.startsWith('$2a$')) {
      console.warn('⚠️  WARNING: ADMIN_PASSWORD no está hasheado. Esto es inseguro en producción.');
      return password === adminPassword;
    }

    // Comparar con bcrypt
    return await bcrypt.compare(password, adminPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Hashear password (útil para generar hash inicial)
 * @param {string} password - Password en texto plano
 * @returns {string} - Hash bcrypt
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Login handler
 */
async function login(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password requerido'
    });
  }

  const isValid = await verifyPassword(password);

  if (isValid) {
    req.session.authenticated = true;
    req.session.loginTime = new Date().toISOString();

    return res.json({
      success: true,
      message: 'Login exitoso'
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Password incorrecto'
    });
  }
}

/**
 * Logout handler
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({
        success: false,
        error: 'Error al cerrar sesión'
      });
    }

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  });
}

/**
 * Verificar si está autenticado (para API)
 */
function checkAuth(req, res) {
  const isAuthenticated = !!(req.session && req.session.authenticated);

  res.json({
    authenticated: isAuthenticated,
    loginTime: req.session && req.session.loginTime
  });
}

module.exports = {
  requireAuth,
  optionalAuth,
  verifyPassword,
  hashPassword,
  login,
  logout,
  checkAuth
};
