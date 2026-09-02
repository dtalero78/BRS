const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Gzip compression - must be before static files
app.use(compression());

// Security middleware - CSP disabled to allow Analytics, Clarity and other third-party scripts
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  validate: { trustProxy: false }
});
app.use('/api/', limiter);

// Rate limit estricto para autenticación: frena fuerza bruta contra /login y /register.
// skipSuccessfulRequests: solo cuentan los intentos FALLIDOS, así un usuario legítimo
// que entra bien nunca se bloquea; un atacante que adivina contraseñas sí se frena.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de autenticación. Intenta de nuevo en unos minutos.',
  validate: { trustProxy: false }
});

// CORS configuration - allow same origin and common dev origins
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
// Redacta el access_token de las URLs de participante para no filtrarlo a los logs.
// Cubre /participant/evaluation/<token> y /api/participant-access/<token>/...
function redactAccessToken(url) {
  if (!url) return url;
  return url
    .replace(/(\/participant\/evaluation\/)[^/?#]+/g, '$1<redacted>')
    // OJO: en '/participant-access/validate/<token>' el token va en el SEGUNDO
    // segmento. La regla de abajo solo tapa el primero, que ahi es 'validate',
    // asi que sin esta linea el token quedaba en claro en el log — y validate
    // es justo la primera llamada que hace toda persona que abre su bateria.
    .replace(/(\/participant-access\/validate\/)[^/?#]+/g, '$1<redacted>')
    .replace(/(\/participant-access\/)[^/?#]+/g, '$1<redacted>');
}
morgan.token('url-redacted', (req) => redactAccessToken(req.originalUrl || req.url));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Formato 'combined' pero con la URL redactada.
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url-redacted HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
}

// --- Visitor WhatsApp notification ---
const visitedIPs = new Map(); // IP -> timestamp
const VISIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per IP

const visitNotifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many requests',
  validate: { trustProxy: false }
});

app.post('/api/visitor-notify', visitNotifyLimiter, async (req, res) => {
  try {
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    const NOTIFY_NUMBER = process.env.VISITOR_NOTIFY_NUMBER || '573008021701';
    if (!WHAPI_TOKEN) return res.status(200).json({ ok: true });

    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const lastVisit = visitedIPs.get(ip);
    if (lastVisit && (now - lastVisit) < VISIT_COOLDOWN_MS) {
      return res.status(200).json({ ok: true });
    }
    visitedIPs.set(ip, now);

    // Clean old entries every 100 visits
    if (visitedIPs.size > 500) {
      for (const [key, ts] of visitedIPs) {
        if (now - ts > VISIT_COOLDOWN_MS) visitedIPs.delete(key);
      }
    }

    const { page, referrer } = req.body || {};
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|crawl|spider|slurp|google|bing|yandex/i.test(userAgent);
    if (isBot) return res.status(200).json({ ok: true });

    // Trunca a 200 caracteres para evitar abuso de payload en un endpoint público.
    const safePage = String(page || '/').slice(0, 200);
    const safeReferrer = String(referrer || 'directo').slice(0, 200);

    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const msg = `🟢 *Nueva visita a BRS Digital*\n\n📄 Pagina: ${safePage}\n🔗 Referido: ${safeReferrer}\n🕐 ${fecha}`;

    const fetch = (await import('node-fetch')).default;
    let formattedNumber = NOTIFY_NUMBER.replace(/[+\-\s]/g, '') + '@s.whatsapp.net';

    fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${WHAPI_TOKEN}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ typing_time: 0, to: formattedNumber, body: msg })
    }).catch(err => console.error('WhatsApp notify error:', err.message));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Visitor notify error:', err.message);
    res.status(200).json({ ok: true });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'BRS API',
    version: '1.0.0'
  });
});

// API Routes
try {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error);
  process.exit(1);
}

try {
  app.use('/api/system', require('./routes/system'));
  console.log('✅ System routes loaded');
} catch (error) {
  console.error('❌ Error loading system routes:', error);
  process.exit(1);
}

// Load additional routes
try {
  app.use('/api/companies', require('./routes/companies'));
  console.log('✅ Companies routes loaded');
} catch (error) {
  console.error('❌ Error loading companies routes:', error);
  process.exit(1);
}

try {
  app.use('/api/users', require('./routes/users'));
  console.log('✅ Users routes loaded');
} catch (error) {
  console.error('❌ Error loading users routes:', error);
  process.exit(1);
}

// Load evaluation routes
try {
  app.use('/api/evaluations', require('./routes/evaluations'));
  console.log('✅ Evaluations routes loaded');
} catch (error) {
  console.error('❌ Error loading evaluations routes:', error);
  process.exit(1);
}

// Add evaluator dashboard endpoint
app.get('/api/evaluator/dashboard', require('./middleware/auth').auth, async (req, res) => {
  try {
    const db = require('./config/database');
    const { getOwnedCompanyIds } = require('./middleware/auth');
    const companyIds = await getOwnedCompanyIds(req.user.userId);

    // Get evaluation statistics
    const evaluationStats = await db('evaluations')
      .whereIn('company_id', companyIds)
      .select(
        db.raw('COUNT(*) as total_evaluations'),
        db.raw("COUNT(CASE WHEN status = 'active' THEN 1 END) as active_evaluations")
      )
      .first();

    // Get participant statistics
    const participantStats = await db('participants')
      .join('participant_evaluations', 'participants.id', 'participant_evaluations.participant_id')
      .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .select(
        db.raw('COUNT(DISTINCT participants.id) as total_participants'),
        db.raw('COUNT(DISTINCT CASE WHEN participant_evaluations.completed_at IS NOT NULL THEN participants.id END) as completed_participants')
      )
      .first();

    // Calculate average completion rate
    const totalParticipants = parseInt(participantStats.total_participants) || 1;
    const completedParticipants = parseInt(participantStats.completed_participants) || 0;
    const averageCompletion = Math.round((completedParticipants / totalParticipants) * 100);

    // Get recent activity (last 10 participant completions)
    const recentActivity = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .whereNotNull('participant_evaluations.completed_at')
      .select(
        'participants.email',
        'evaluations.name as evaluation_name',
        'participant_evaluations.completed_at'
      )
      .orderBy('participant_evaluations.completed_at', 'desc')
      .limit(10);

    // Pruebas ya respondidas que siguen sin pagar: son las que bloquean los
    // informes, y el numero que ve el evaluador en el hub.
    let pendingPaymentCount = 0;
    const { REQUIRE_PAID_EVALUATION } = require('./config/brand');
    if (REQUIRE_PAID_EVALUATION) {
      const pendingRow = await db('participant_evaluations as pe')
        .join('evaluations as e', 'pe.evaluation_id', 'e.id')
        .whereIn('e.company_id', companyIds)
        .whereNull('pe.paid_at')
        .where('e.paid', false)
        .where('pe.status', 'completed')
        .count('* as c')
        .first();
      pendingPaymentCount = parseInt(pendingRow.c) || 0;
    }

    const stats = {
      totalCompanies: companyIds.length,
      totalEvaluations: parseInt(evaluationStats.total_evaluations) || 0,
      activeEvaluations: parseInt(evaluationStats.active_evaluations) || 0,
      totalParticipants: parseInt(participantStats.total_participants) || 0,
      completedAssessments: parseInt(participantStats.completed_participants) || 0,
      pendingAssessments: totalParticipants - completedParticipants,
      averageCompletion: averageCompletion,
      pendingPaymentCount,
      paymentsEnabled: REQUIRE_PAID_EVALUATION
    };

    res.json({
      stats,
      recentActivity
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Load participants routes
try {
  app.use('/api/participants', require('./routes/participants'));
  console.log('✅ Participants routes loaded');
} catch (error) {
  console.error('❌ Error loading participants routes:', error);
  process.exit(1);
}

// Load questionnaires routes
try {
  app.use('/api/questionnaires', require('./routes/questionnaires'));
  console.log('✅ Questionnaires routes loaded');
} catch (error) {
  console.error('❌ Error loading questionnaires routes:', error);
  process.exit(1);
}

// Load responses routes
try {
  app.use('/api/responses', require('./routes/responses'));
  console.log('✅ Responses routes loaded');
} catch (error) {
  console.error('❌ Error loading responses routes:', error);
  process.exit(1);
}

// Load participant access routes (no auth required)
try {
  app.use('/api/participant-access', require('./routes/participant-access'));
  console.log('✅ Participant access routes loaded');
} catch (error) {
  console.error('❌ Error loading participant access routes:', error);
  process.exit(1);
}

// Results and reports routes
app.use('/api/results', require('./routes/results'));
app.use('/api/reports', require('./routes/reports'));
console.log('✅ Results routes loaded');
console.log('✅ Reports routes loaded');

// Super-admin (cross-tenant) routes
try {
  app.use('/api/payments', require('./routes/payments'));
  console.log('✅ Payments routes loaded');
} catch (error) {
  console.error('❌ Error loading payments routes:', error);
  process.exit(1);
}

try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Error loading admin routes:', error);
  process.exit(1);
}

// Photo import (Claude Vision) routes
try {
  app.use('/api/photo-import', require('./routes/photo-import'));
  console.log('✅ Photo import routes loaded');
} catch (error) {
  console.error('❌ Error loading photo-import routes:', error);
  process.exit(1);
}

// Server-to-server integration routes (BSL-PLATAFORMA2 / Platzi)
try {
  app.use('/api/integration', require('./routes/integration'));
  console.log('✅ Integration routes loaded');
} catch (error) {
  console.error('❌ Error loading integration routes:', error);
  process.exit(1);
}

// Serve static files (uploads, reports)
app.use('/uploads', express.static('uploads'));

// Instancias sin sitio comercial (licenciatarios) no deben servir el
// robots.txt ni el sitemap.xml del repo: apuntan al dominio de BRS e invitan
// a indexar una app privada. Va ANTES de express.static para ganarle al
// archivo de public/.
const { HAS_MARKETING_SITE } = require('./config/brand');
if (!HAS_MARKETING_SITE) {
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });
  app.get('/sitemap.xml', (req, res) => res.status(404).end());
}

// Serve frontend static files (built by Next.js export)
const frontendPath = path.join(__dirname, '..', 'frontend', 'out');
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    if (filePath.includes('/_next/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Error de validación', 
      details: err.details 
    });
  }

  // Database errors
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({ error: 'Referencia inválida' });
  }

  // Generic server error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Error interno del servidor'
  });
});

// SPA fallback - serve frontend for non-API routes
const fs = require('fs');

// Resolve a URL path to a file, supporting Next.js [param] dynamic directories
function resolveNextFile(basePath, urlPath) {
  const segments = urlPath.split('/').filter(Boolean);

  // Try exact match first
  const exactIndex = path.join(basePath, urlPath, 'index.html');
  if (fs.existsSync(exactIndex)) return exactIndex;
  const exactHtml = path.join(basePath, urlPath + '.html');
  if (fs.existsSync(exactHtml)) return exactHtml;

  // Try replacing each segment with a [param] wildcard directory
  let currentDir = basePath;
  for (let i = 0; i < segments.length; i++) {
    const exactDir = path.join(currentDir, segments[i]);
    if (fs.existsSync(exactDir)) {
      currentDir = exactDir;
    } else {
      // Look for a [param] directory in currentDir
      try {
        const entries = fs.readdirSync(currentDir);
        const dynamicDir = entries.find(e => e.startsWith('[') && e.endsWith(']'));
        if (dynamicDir) {
          currentDir = path.join(currentDir, dynamicDir);
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }
  }

  const resolved = path.join(currentDir, 'index.html');
  return fs.existsSync(resolved) ? resolved : null;
}

app.use('*', (req, res) => {
  // If it's an API route that wasn't matched, return 404 JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }

  // Don't serve index.html for static asset requests
  if (req.originalUrl.startsWith('/_next/') || req.originalUrl.match(/\.(js|css|map|png|jpg|svg|ico|mp4|woff|woff2|otf)$/)) {
    return res.status(404).end();
  }

  // El query string no es parte de la ruta: sin quitarlo, un link con
  // ?utm=... no resuelve el archivo y termina cayendo al index.
  const pathname = req.originalUrl.split('?')[0];
  const urlPath = pathname.replace(/\/$/, '') || '/index';

  // Try to resolve the file (supports Next.js [param] directories)
  const resolved = resolveNextFile(frontendPath, urlPath);
  if (resolved) {
    return res.sendFile(resolved);
  }

  // Link del participante SIN token (la parte dinamica del boton de WhatsApp
  // salio vacia, o alguien recorto la URL): va a la puerta general, no al
  // index. En las marcas sin sitio comercial el index es el puente al login,
  // que para un participante es un callejon sin salida — y si ese navegador
  // tiene una sesion de evaluador abierta, el puente lo deja mirando el
  // dashboard del evaluador. En /acceso entra con su numero de documento.
  if (/^\/participant\/evaluation\/?$/.test(pathname)) {
    return res.redirect(302, '/acceso');
  }

  // Final fallback to root index.html
  const fallback = path.join(frontendPath, 'index.html');
  if (fs.existsSync(fallback)) {
    return res.sendFile(fallback);
  }

  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Handlers globales de errores del proceso.
// Se loguean con stack completo. En uncaughtException elegimos loguear-sin-crashear
// para no tumbar producción por un error aislado (en vez de un exit silencioso).
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection:', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ uncaughtException:', err && err.stack ? err.stack : err);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
🚀 Servidor BRS iniciado correctamente
📍 Puerto: ${PORT}
🌍 Ambiente: ${process.env.NODE_ENV}
🕒 Tiempo: ${new Date().toLocaleString()}
  `);
});

module.exports = app;