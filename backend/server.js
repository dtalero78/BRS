const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting (required for codespaces)
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS), // limit each IP to 100 requests per windowMs
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://automatic-fiesta-v4x7g75pq7wfw999-3000.app.github.dev',
    /^https:\/\/.*\.app\.github\.dev$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

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

// Temporarily disable other routes until needed
/*
app.use('/api/results', require('./routes/results'));
app.use('/api/reports', require('./routes/reports'));
*/

// Serve static files (uploads, reports)
app.use('/uploads', express.static('uploads'));

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

// 404 handler
app.use('*', (req, res) => {
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