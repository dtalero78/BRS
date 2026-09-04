const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
const { auth, SHARED_WORKSPACE } = require('../middleware/auth');

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Perfil: los campos de texto se guardan en columnas varchar(255).
// Validamos longitud para rechazar valores que excedan el límite.
const profileSchema = Joi.object({
  full_name: Joi.string().max(255).allow('', null).optional(),
  professional_title: Joi.string().max(255).allow('', null).optional(),
  license_number: Joi.string().max(255).allow('', null).optional()
}).unknown(true);

// Register evaluator (self-service, no company required)
router.post('/register', async (req, res) => {
  try {
    // Anti-spam: honeypot field should be empty
    if (req.body._hp) {
      return res.status(201).json({ message: 'Cuenta creada exitosamente.' });
    }

    // Anti-spam: form must take at least 3 seconds to fill.
    // Devolvemos un error claro (no un 201 falso) para no perder en silencio
    // un registro legítimo enviado muy rápido.
    if (req.body._ts !== undefined && req.body._ts < 3000) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' });
    }

    // Anti-spam: detect suspicious email patterns (random dots/chars)
    const email = (req.body.email || '').toLowerCase();
    const localPart = email.split('@')[0] || '';
    const dotCount = (localPart.match(/\./g) || []).length;
    const hasManyDots = dotCount >= 4;
    const looksRandom = /^[a-z]{1,3}(\.[a-z0-9]{1,3}){3,}/i.test(localPart);
    if (hasManyDots && looksRandom) {
      return res.status(201).json({ message: 'Cuenta creada exitosamente.' });
    }

    const { error } = registerSchema.validate({
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert evaluator (no company_id)
    await db('users').insert({
      email,
      password_hash: passwordHash,
      role: 'evaluator',
      full_name: `${firstName} ${lastName}`.trim()
    });

    res.status(201).json({
      message: 'Cuenta creada exitosamente. Inicia sesión para continuar.',
      success: true
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = req.body;

    // Find user (LEFT JOIN for users without a company)
    const user = await db('users')
      .leftJoin('companies', 'users.company_id', 'companies.id')
      .select(
        'users.*',
        'companies.name as company_name',
        'companies.nit as company_nit'
      )
      .where('users.email', email)
      .where('users.active', true)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Get evaluator's companies
    let companies = [];
    if (user.role === 'evaluator') {
      const companiesQuery = db('companies').select('id', 'name', 'nit').orderBy('name');
      // En modo compartido el evaluador ve todas las empresas de la instancia.
      if (!SHARED_WORKSPACE) companiesQuery.where('created_by', user.id);
      companies = await companiesQuery;
    }

    // Generate JWT (no companyId - evaluators manage multiple companies)
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companies
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'role', 'full_name', 'professional_title', 'license_number', 'signature_image', 'logo_image')
      .where('id', req.user.userId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Get owned companies
    const companiesQuery = db('companies').select('id', 'name', 'nit').orderBy('name');
    if (!SHARED_WORKSPACE) companiesQuery.where('created_by', user.id);
    const companies = await companiesQuery;

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      professional_title: user.professional_title,
      license_number: user.license_number,
      signature_image: user.signature_image,
      logo_image: user.logo_image,
      companies
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { full_name, professional_title, license_number } = req.body;

    const { error } = profileSchema.validate({ full_name, professional_title, license_number });
    if (error) return res.status(400).json({ error: error.details[0].message });

    await db('users')
      .where('id', req.user.userId)
      .update({
        full_name: full_name || null,
        professional_title: professional_title || null,
        license_number: license_number || null,
        updated_at: db.fn.now()
      });

    res.json({ message: 'Perfil actualizado exitosamente' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Upload signature image (base64)
router.post('/profile/signature', auth, async (req, res) => {
  try {
    const { signature_image } = req.body;

    if (!signature_image) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    if (!signature_image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }
    // ~500KB limit (base64 is ~1.33x the binary size)
    if (signature_image.length > 700000) {
      return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
    }

    await db('users')
      .where('id', req.user.userId)
      .update({ signature_image, updated_at: db.fn.now() });

    res.json({ message: 'Firma guardada exitosamente' });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Logo de la empresa evaluadora (base64). Mismo contrato que la firma: data
// URL en TEXT y tope de ~500KB, porque el disco de App Platform es efimero y
// un archivo subido no sobreviviria al siguiente deploy.
router.post('/profile/logo', auth, async (req, res) => {
  try {
    const { logo_image } = req.body;

    if (!logo_image) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    if (!logo_image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }
    if (logo_image.length > 700000) {
      return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 500KB.' });
    }

    await db('users')
      .where('id', req.user.userId)
      .update({ logo_image, updated_at: db.fn.now() });

    res.json({ message: 'Logo guardado exitosamente' });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete logo
router.delete('/profile/logo', auth, async (req, res) => {
  try {
    await db('users')
      .where('id', req.user.userId)
      .update({ logo_image: null, updated_at: db.fn.now() });

    res.json({ message: 'Logo eliminado' });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete signature image
router.delete('/profile/signature', auth, async (req, res) => {
  try {
    await db('users')
      .where('id', req.user.userId)
      .update({ signature_image: null, updated_at: db.fn.now() });

    res.json({ message: 'Firma eliminada' });
  } catch (error) {
    console.error('Delete signature error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Logout (for audit purposes)
router.post('/logout', auth, async (req, res) => {
  try {
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'logout',
      table_name: 'users',
      record_id: req.user.userId
    });

    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
