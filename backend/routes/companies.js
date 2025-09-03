const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');

// Get company profile
router.get('/profile', auth, async (req, res) => {
  try {
    const company = await db('companies')
      .where('id', req.user.companyId)
      .first();

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({
      id: company.id,
      name: company.name,
      nit: company.nit,
      email: company.email,
      phone: company.phone,
      address: company.address,
      sector: company.sector,
      size: company.size,
      createdAt: company.created_at,
      updatedAt: company.updated_at
    });

  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update company profile
router.put('/profile', auth, authorize('admin'), async (req, res) => {
  try {
    const allowedFields = ['name', 'email', 'phone', 'address', 'sector', 'size'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const [company] = await db('companies')
      .where('id', req.user.companyId)
      .update(updateData)
      .returning('*');

    // Log update
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'update_company_profile',
      entity_type: 'company',
      entity_id: req.user.companyId,
      details: updateData
    });

    res.json({
      id: company.id,
      name: company.name,
      nit: company.nit,
      email: company.email,
      phone: company.phone,
      address: company.address,
      sector: company.sector,
      size: company.size,
      updatedAt: company.updated_at
    });

  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get company statistics
router.get('/stats', auth, async (req, res) => {
  try {
    // Total evaluations
    const totalEvaluations = await db('evaluations')
      .where('company_id', req.user.companyId)
      .count('* as count')
      .first();

    // Active evaluations
    const activeEvaluations = await db('evaluations')
      .where('company_id', req.user.companyId)
      .where('status', 'active')
      .count('* as count')
      .first();

    // Total participants
    const totalParticipants = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('evaluations.company_id', req.user.companyId)
      .count('* as count')
      .first();

    // Completed participants
    const completedParticipants = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('evaluations.company_id', req.user.companyId)
      .where('participants.status', 'completed')
      .count('* as count')
      .first();

    // Recent evaluations
    const recentEvaluations = await db('evaluations')
      .where('company_id', req.user.companyId)
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('id', 'name', 'status', 'total_participants', 'completed_participants', 'created_at');

    res.json({
      summary: {
        totalEvaluations: parseInt(totalEvaluations.count),
        activeEvaluations: parseInt(activeEvaluations.count),
        totalParticipants: parseInt(totalParticipants.count),
        completedParticipants: parseInt(completedParticipants.count),
        completionRate: totalParticipants.count > 0 
          ? Math.round((completedParticipants.count / totalParticipants.count) * 100)
          : 0
      },
      recentEvaluations: recentEvaluations.map(evaluation => ({
        id: evaluation.id,
        name: evaluation.name,
        status: evaluation.status,
        totalParticipants: evaluation.total_participants,
        completedParticipants: evaluation.completed_participants,
        progress: evaluation.total_participants > 0 
          ? Math.round((evaluation.completed_participants / evaluation.total_participants) * 100)
          : 0,
        createdAt: evaluation.created_at
      }))
    });

  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ADMIN ROUTES - for managing all companies

// Get all companies (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const companies = await db('companies as c')
      .leftJoin('users as u', function() {
        this.on('c.id', '=', 'u.company_id')
            .andOn('u.active', '=', db.raw('true'));
      })
      .select(
        'c.id',
        'c.name', 
        'c.nit',
        'c.contact_email',
        'c.contact_phone',
        'c.active',
        'c.created_at',
        'c.updated_at'
      )
      .count('u.id as users_count')
      .groupBy('c.id', 'c.name', 'c.nit', 'c.contact_email', 'c.contact_phone', 'c.active', 'c.created_at', 'c.updated_at')
      .orderBy('c.created_at', 'desc');
    
    res.json({
      success: true,
      companies: companies.map(company => ({
        ...company,
        users_count: parseInt(company.users_count)
      }))
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      error: 'Error al obtener empresas'
    });
  }
});

// Create new company (admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { name, nit, contact_email, contact_phone } = req.body;

    // Validate required fields
    if (!name || !nit || !contact_email) {
      return res.status(400).json({
        error: 'Nombre, NIT y email de contacto son requeridos'
      });
    }

    // Check if NIT already exists
    const existingCompany = await db('companies')
      .where('nit', nit)
      .first();

    if (existingCompany) {
      return res.status(409).json({
        error: 'Ya existe una empresa con este NIT'
      });
    }

    // Insert company
    const [company] = await db('companies')
      .insert({
        name,
        nit,
        contact_email,
        contact_phone: contact_phone || null,
        active: true
      })
      .returning(['id', 'name', 'nit', 'contact_email', 'contact_phone', 'active', 'created_at']);
    
    res.status(201).json({
      success: true,
      message: 'Empresa creada exitosamente',
      company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      error: 'Error al crear empresa'
    });
  }
});

// Update company (admin only)
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nit, contact_email, contact_phone, active } = req.body;

    // Check if company exists
    const existingCompany = await db('companies')
      .where('id', id)
      .first();

    if (!existingCompany) {
      return res.status(404).json({
        error: 'Empresa no encontrada'
      });
    }

    // Check if NIT is taken by another company
    if (nit) {
      const nitCheck = await db('companies')
        .where('nit', nit)
        .whereNot('id', id)
        .first();

      if (nitCheck) {
        return res.status(409).json({
          error: 'Ya existe otra empresa con este NIT'
        });
      }
    }

    // Build update data
    const updateData = {};

    if (name) updateData.name = name;
    if (nit) updateData.nit = nit;
    if (contact_email) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone || null;
    if (typeof active === 'boolean') updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar'
      });
    }

    updateData.updated_at = db.fn.now();

    const [company] = await db('companies')
      .where('id', id)
      .update(updateData)
      .returning(['id', 'name', 'nit', 'contact_email', 'contact_phone', 'active', 'updated_at']);

    res.json({
      success: true,
      message: 'Empresa actualizada exitosamente',
      company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      error: 'Error al actualizar empresa'
    });
  }
});

// Delete company (admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company exists
    const existingCompany = await db('companies')
      .where('id', id)
      .first();

    if (!existingCompany) {
      return res.status(404).json({
        error: 'Empresa no encontrada'
      });
    }

    // Check for related records that might prevent deletion
    const userCount = await db('users')
      .where('company_id', id)
      .count('* as count')
      .first();

    if (parseInt(userCount.count) > 0) {
      // Instead of deleting, deactivate the company
      await db('companies')
        .where('id', id)
        .update({ active: false });

      return res.json({
        success: true,
        message: 'Empresa desactivada (tiene usuarios asociados)'
      });
    }

    // Delete company
    await db('companies')
      .where('id', id)
      .del();

    res.json({
      success: true,
      message: 'Empresa eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      error: 'Error al eliminar empresa'
    });
  }
});

module.exports = router;