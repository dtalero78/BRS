const express = require('express');
const bcrypt = require('bcrypt');
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');
const router = express.Router();

// Get all users (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.active,
        u.created_at,
        u.updated_at,
        u.company_id,
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY u.created_at DESC
    `;

    const result = await db.raw(query);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Error al obtener usuarios'
    });
  }
});

// Get user by ID
router.get('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.active,
        u.created_at,
        u.updated_at,
        u.company_id,
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ?
    `;

    const result = await db.raw(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Error al obtener usuario'
    });
  }
});

// Create new user (admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { email, password, role, company_id } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Email, contraseña y rol son requeridos'
      });
    }

    // Validate role
    if (!['admin', 'evaluator', 'participant'].includes(role)) {
      return res.status(400).json({
        error: 'Rol inválido'
      });
    }

    // Validate that evaluators must have a company
    if (role === 'evaluator' && !company_id) {
      return res.status(400).json({
        error: 'Los evaluadores deben tener una empresa asignada'
      });
    }

    // Check if email already exists
    const existingUser = await db.raw(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un usuario con este email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const query = `
      INSERT INTO users (email, password_hash, role, company_id, active)
      VALUES (?, ?, ?, ?, true)
      RETURNING id, email, role, company_id, active, created_at
    `;

    const values = [
      email,
      hashedPassword,
      role,
      company_id || null
    ];

    const result = await db.raw(query, values);
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Error al crear usuario'
    });
  }
});

// Update user (admin only)
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role, company_id, active } = req.body;

    // Check if user exists
    const existingUser = await db.raw(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Validate role if provided
    if (role && !['admin', 'evaluator', 'participant'].includes(role)) {
      return res.status(400).json({
        error: 'Rol inválido'
      });
    }

    // Validate that evaluators must have a company
    if (role === 'evaluator' && !company_id) {
      return res.status(400).json({
        error: 'Los evaluadores deben tener una empresa asignada'
      });
    }

    // Check if email is taken by another user
    if (email) {
      const emailCheck = await db.raw(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Ya existe otro usuario con este email'
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (email) {
      updates.push(`email = ?`);
      values.push(email);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password_hash = ?`);
      values.push(hashedPassword);
    }

    if (role) {
      updates.push(`role = ?`);
      values.push(role);
    }

    if (company_id !== undefined) {
      updates.push(`company_id = ?`);
      values.push(company_id || null);
    }

    if (typeof active === 'boolean') {
      updates.push(`active = ?`);
      values.push(active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
      RETURNING id, email, role, company_id, active, updated_at
    `;

    const result = await db.raw(query, values);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Error al actualizar usuario'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await db.raw(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Prevent deleting the last admin
    if (existingUser.rows[0].role === 'admin') {
      const adminCount = await db.raw(
        'SELECT COUNT(*) as count FROM users WHERE role = ? AND active = true',
        ['admin']
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({
          error: 'No se puede eliminar el último administrador del sistema'
        });
      }
    }

    // Check for related records that might prevent deletion
    const evaluationCheck = await db.raw(
      'SELECT COUNT(*) as count FROM evaluations WHERE evaluator_id = ?',
      [id]
    );

    if (parseInt(evaluationCheck.rows[0].count) > 0) {
      // Instead of deleting, deactivate the user
      await db.raw(
        'UPDATE users SET active = false WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: 'Usuario desactivado (tiene evaluaciones asociadas)'
      });
    }

    // Delete user
    await db.raw('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Error al eliminar usuario'
    });
  }
});

// Get users by company (for evaluator assignment)
router.get('/company/:companyId', auth, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Admins can see users from any company
    // Evaluators can only see users from their own company
    let whereClause = 'WHERE u.company_id = ?';
    const values = [companyId];

    if (req.user.role !== 'admin') {
      whereClause += ' AND u.company_id = ?';
      values.push(req.user.company_id);
    }

    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.active,
        u.created_at,
        c.name as company_name
      FROM users u
      JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY u.email
    `;

    const result = await db.raw(query, values);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching company users:', error);
    res.status(500).json({
      error: 'Error al obtener usuarios de la empresa'
    });
  }
});

module.exports = router;