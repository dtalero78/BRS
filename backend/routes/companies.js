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

module.exports = router;