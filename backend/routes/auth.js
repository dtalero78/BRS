const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// Validation schemas
const registerSchema = Joi.object({
  company: Joi.object({
    name: Joi.string().required(),
    nit: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string(),
    address: Joi.string(),
    sector: Joi.string(),
    size: Joi.string().valid('micro', 'pequeña', 'mediana', 'grande')
  }).required(),
  user: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required()
  }).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register company and admin user
router.post('/register', async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { company, user } = req.body;

    // Check if company already exists
    const existingCompany = await db('companies').where('nit', company.nit).first();
    if (existingCompany) {
      return res.status(409).json({ error: 'La empresa ya está registrada' });
    }

    // Check if user already exists
    const existingUser = await db('users').where('email', user.email).first();
    if (existingUser) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(user.password, saltRounds);

    // Start transaction
    await db.transaction(async (trx) => {
      // Insert company
      const [companyId] = await trx('companies')
        .insert({
          name: company.name,
          nit: company.nit,
          contact_email: company.email,
          contact_phone: company.phone
        })
        .returning('id');

      // Insert admin user
      await trx('users').insert({
        company_id: companyId.id,
        email: user.email,
        password_hash: passwordHash,
        role: 'evaluator'
      });
    });

    res.status(201).json({ 
      message: 'Empresa y usuario registrados exitosamente',
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

    // Find user with company info
    const user = await db('users')
      .join('companies', 'users.company_id', 'companies.id')
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

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        companyId: user.company_id,
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
        company: {
          id: user.company_id,
          name: user.company_name,
          nit: user.company_nit
        }
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
      .join('companies', 'users.company_id', 'companies.id')
      .select(
        'users.id',
        'users.email',
        'users.role',
        'companies.id as company_id',
        'companies.name as company_name',
        'companies.nit as company_nit'
      )
      .where('users.id', req.user.userId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      company: {
        id: user.company_id,
        name: user.company_name,
        nit: user.company_nit
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Logout (for audit purposes)
router.post('/logout', auth, async (req, res) => {
  try {
    // Log logout action
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