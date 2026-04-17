const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

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

// Register evaluator (self-service, no company required)
router.post('/register', async (req, res) => {
  try {
    // Anti-spam: honeypot field should be empty
    if (req.body._hp) {
      return res.status(201).json({ message: 'Cuenta creada exitosamente.' });
    }

    // Anti-spam: form must take at least 3 seconds to fill
    if (req.body._ts !== undefined && req.body._ts < 3000) {
      return res.status(201).json({ message: 'Cuenta creada exitosamente.' });
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
      role: 'evaluator'
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
      companies = await db('companies')
        .where('created_by', user.id)
        .select('id', 'name', 'nit')
        .orderBy('name');
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
      .select('id', 'email', 'role')
      .where('id', req.user.userId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Get owned companies
    const companies = await db('companies')
      .where('created_by', user.id)
      .select('id', 'name', 'nit')
      .orderBy('name');

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      companies
    });

  } catch (error) {
    console.error('Profile error:', error);
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
