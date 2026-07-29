const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { SHARED_WORKSPACE } = require('../config/brand');

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

// Helper: get company IDs owned by an evaluator.
//
// En instancias con SHARED_WORKSPACE (un solo equipo, ej. un licenciatario)
// el aislamiento por creador no aplica: se devuelven todas las empresas. Es
// el unico punto por el que pasan los ~40 filtros de ownership de las rutas,
// asi que basta con relajarlo aqui.
async function getOwnedCompanyIds(userId) {
  const query = db('companies').select('id');
  if (!SHARED_WORKSPACE) query.where('created_by', userId);
  const rows = await query;
  return rows.map(r => r.id);
}

// Helper: si un evaluador puede administrar (editar/borrar) una empresa.
// El admin pasa siempre; el evaluador solo si la creo, salvo en modo
// compartido.
function canManageCompany(user, company) {
  if (!user || !company) return false;
  if (user.role === 'admin') return true;
  if (SHARED_WORKSPACE) return true;
  return company.created_by === user.userId;
}

// Super-admin: role='admin' O email en la allowlist configurada por entorno.
// La allowlist NO se hardcodea en el repo (era publico): se lee de
// BRS_SUPER_ADMIN_EMAILS (lista separada por comas). Sin la env var, solo
// role='admin' concede super-admin. Esto evita que un auto-registro con un
// email "privilegiado" hardcodeado escale a super-admin.
const SUPER_ADMIN_EMAILS = (process.env.BRS_SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

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

module.exports = { auth, authorize, getOwnedCompanyIds, canManageCompany, isSuperAdmin, requireSuperAdmin, SUPER_ADMIN_EMAILS, SHARED_WORKSPACE };
