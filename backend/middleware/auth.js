const jwt = require('jsonwebtoken');
const db = require('../config/database');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const user = await db('users')
      .where('id', decoded.userId)
      .where('active', true)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: user.email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    next();
  };
};

// Helper: get company IDs owned by an evaluator
async function getOwnedCompanyIds(userId) {
  const rows = await db('companies').where('created_by', userId).select('id');
  return rows.map(r => r.id);
}

// Super-admin: role='admin' OR email matches the configured super-admin email.
// Lets us gate cross-tenant admin features without changing the existing role of d_talero@yahoo.com.
const SUPER_ADMIN_EMAILS = ['d_talero@yahoo.com'];

function isSuperAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'No autorizado' });
  next();
};

module.exports = { auth, authorize, getOwnedCompanyIds, isSuperAdmin, requireSuperAdmin, SUPER_ADMIN_EMAILS };
