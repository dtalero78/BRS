const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  validate: { trustProxy: false }
});
app.use('/api/', limiter);

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
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

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
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  app.use('/api/system', require('./routes/system'));
  console.log('✅ System routes loaded');
} catch (error) {
  console.error('❌ Error loading system routes:', error.message);
}

// Load additional routes
try {
  app.use('/api/companies', require('./routes/companies'));
  console.log('✅ Companies routes loaded');
} catch (error) {
  console.error('❌ Error loading companies routes:', error.message);
}

try {
  app.use('/api/users', require('./routes/users'));
  console.log('✅ Users routes loaded');
} catch (error) {
  console.error('❌ Error loading users routes:', error.message);
}

// Load evaluation routes
try {
  app.use('/api/evaluations', require('./routes/evaluations'));
  console.log('✅ Evaluations routes loaded');
} catch (error) {
  console.error('❌ Error loading evaluations routes:', error.message);
}

// Add evaluator dashboard endpoint
app.get('/api/evaluator/dashboard', require('./middleware/auth').auth, async (req, res) => {
  try {
    const db = require('./config/database');
    const companyId = req.user.companyId;

    // Get evaluation statistics
    const evaluationStats = await db('evaluations')
      .where('company_id', companyId)
      .select(
        db.raw('COUNT(*) as total_evaluations'),
        db.raw("COUNT(CASE WHEN status = 'active' THEN 1 END) as active_evaluations")
      )
      .first();

    // Get participant statistics
    const participantStats = await db('participants')
      .join('participant_evaluations', 'participants.id', 'participant_evaluations.participant_id')
      .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
      .where('evaluations.company_id', companyId)
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
      .where('evaluations.company_id', companyId)
      .whereNotNull('participant_evaluations.completed_at')
      .select(
        'participants.email',
        'evaluations.name as evaluation_name',
        'participant_evaluations.completed_at'
      )
      .orderBy('participant_evaluations.completed_at', 'desc')
      .limit(10);

    const stats = {
      totalEvaluations: parseInt(evaluationStats.total_evaluations) || 0,
      activeEvaluations: parseInt(evaluationStats.active_evaluations) || 0,
      totalParticipants: parseInt(participantStats.total_participants) || 0,
      completedAssessments: parseInt(participantStats.completed_participants) || 0,
      pendingAssessments: totalParticipants - completedParticipants,
      averageCompletion: averageCompletion
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
  console.error('❌ Error loading participants routes:', error.message);
}

// Load questionnaires routes
try {
  app.use('/api/questionnaires', require('./routes/questionnaires'));
  console.log('✅ Questionnaires routes loaded');
} catch (error) {
  console.error('❌ Error loading questionnaires routes:', error.message);
}

// Load responses routes
try {
  app.use('/api/responses', require('./routes/responses'));
  console.log('✅ Responses routes loaded');
} catch (error) {
  console.error('❌ Error loading responses routes:', error.message);
}

// Load participant access routes (no auth required)
try {
  app.use('/api/participant-access', require('./routes/participant-access'));
  console.log('✅ Participant access routes loaded');
} catch (error) {
  console.error('❌ Error loading participant access routes:', error.message);
}

// Results and reports routes
app.use('/api/results', require('./routes/results'));
app.use('/api/reports', require('./routes/reports'));
console.log('✅ Results routes loaded');
console.log('✅ Reports routes loaded');

// Serve static files (uploads, reports)
app.use('/uploads', express.static('uploads'));

// Serve frontend static files (built by Next.js export)
const frontendPath = path.join(__dirname, '..', 'frontend', 'out');
app.use(express.static(frontendPath));

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

  const urlPath = req.originalUrl.replace(/\/$/, '') || '/index';

  // Try to resolve the file (supports Next.js [param] directories)
  const resolved = resolveNextFile(frontendPath, urlPath);
  if (resolved) {
    return res.sendFile(resolved);
  }

  // Final fallback to root index.html
  const fallback = path.join(frontendPath, 'index.html');
  if (fs.existsSync(fallback)) {
    return res.sendFile(fallback);
  }

  res.status(404).json({ error: 'Endpoint no encontrado' });
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