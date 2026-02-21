const express = require('express');
const router = express.Router();
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');

// ============================================================
// EVALUATOR ROUTES - manage own companies
// ============================================================

// Get evaluator's companies
router.get('/mine', auth, authorize('evaluator'), async (req, res) => {
  try {
    const companies = await db('companies')
      .where('created_by', req.user.userId)
      .orderBy('created_at', 'desc')
      .select('id', 'name', 'nit', 'contact_email', 'contact_phone', 'active', 'created_at', 'updated_at');

    res.json({
      success: true,
      companies
    });
  } catch (error) {
    console.error('Error fetching evaluator companies:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Create company (evaluator or admin)
router.post('/', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { name, nit, contact_email, contact_phone } = req.body;

    if (!name || !nit || !contact_email) {
      return res.status(400).json({
        error: 'Nombre, NIT y email de contacto son requeridos'
      });
    }

    // Check if NIT already exists
    const existingCompany = await db('companies').where('nit', nit).first();
    if (existingCompany) {
      return res.status(409).json({ error: 'Ya existe una empresa con este NIT' });
    }

    const [company] = await db('companies')
      .insert({
        name,
        nit,
        contact_email,
        contact_phone: contact_phone || null,
        active: true,
        created_by: req.user.userId
      })
      .returning(['id', 'name', 'nit', 'contact_email', 'contact_phone', 'active', 'created_at']);

    res.status(201).json({
      success: true,
      message: 'Empresa creada exitosamente',
      company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

// Update company (owner or admin)
router.put('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nit, contact_email, contact_phone, active } = req.body;

    // Check ownership
    const existingCompany = await db('companies').where('id', id).first();
    if (!existingCompany) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    if (req.user.role === 'evaluator' && existingCompany.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Check NIT uniqueness
    if (nit) {
      const nitCheck = await db('companies').where('nit', nit).whereNot('id', id).first();
      if (nitCheck) {
        return res.status(409).json({ error: 'Ya existe otra empresa con este NIT' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (nit) updateData.nit = nit;
    if (contact_email) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone || null;
    if (typeof active === 'boolean') updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateData.updated_at = db.fn.now();

    const [company] = await db('companies')
      .where('id', id)
      .update(updateData)
      .returning(['id', 'name', 'nit', 'contact_email', 'contact_phone', 'active', 'updated_at']);

    res.json({ success: true, message: 'Empresa actualizada exitosamente', company });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

// Delete company (owner or admin)
router.delete('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingCompany = await db('companies').where('id', id).first();
    if (!existingCompany) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    if (req.user.role === 'evaluator' && existingCompany.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Check for evaluations
    const evalCount = await db('evaluations').where('company_id', id).count('* as count').first();
    if (parseInt(evalCount.count) > 0) {
      await db('companies').where('id', id).update({ active: false });
      return res.json({ success: true, message: 'Empresa desactivada (tiene evaluaciones asociadas)' });
    }

    await db('companies').where('id', id).del();
    res.json({ success: true, message: 'Empresa eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Error al eliminar empresa' });
  }
});

// ============================================================
// SHARED ROUTES
// ============================================================

// Get company stats (evaluator sees own companies' stats)
router.get('/stats', auth, async (req, res) => {
  try {
    const companyIds = await getOwnedCompanyIds(req.user.userId);

    const totalEvaluations = await db('evaluations')
      .whereIn('company_id', companyIds).count('* as count').first();

    const activeEvaluations = await db('evaluations')
      .whereIn('company_id', companyIds).where('status', 'active').count('* as count').first();

    const totalParticipants = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds).count('* as count').first();

    const completedParticipants = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .where('participants.status', 'completed').count('* as count').first();

    const recentEvaluations = await db('evaluations')
      .whereIn('company_id', companyIds)
      .orderBy('created_at', 'desc').limit(5)
      .select('id', 'name', 'status', 'total_participants', 'completed_participants', 'created_at');

    res.json({
      summary: {
        totalEvaluations: parseInt(totalEvaluations.count),
        activeEvaluations: parseInt(activeEvaluations.count),
        totalParticipants: parseInt(totalParticipants.count),
        completedParticipants: parseInt(completedParticipants.count),
        completionRate: totalParticipants.count > 0
          ? Math.round((completedParticipants.count / totalParticipants.count) * 100) : 0
      },
      recentEvaluations: recentEvaluations.map(e => ({
        id: e.id, name: e.name, status: e.status,
        totalParticipants: e.total_participants,
        completedParticipants: e.completed_participants,
        progress: e.total_participants > 0 ? Math.round((e.completed_participants / e.total_participants) * 100) : 0,
        createdAt: e.created_at
      }))
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// ADMIN ROUTES - see all companies
// ============================================================

router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const companies = await db('companies as c')
      .leftJoin('users as u', function() {
        this.on('c.id', '=', 'u.company_id').andOn('u.active', '=', db.raw('true'));
      })
      .select('c.id', 'c.name', 'c.nit', 'c.contact_email', 'c.contact_phone', 'c.active', 'c.created_at', 'c.updated_at')
      .count('u.id as users_count')
      .groupBy('c.id', 'c.name', 'c.nit', 'c.contact_email', 'c.contact_phone', 'c.active', 'c.created_at', 'c.updated_at')
      .orderBy('c.created_at', 'desc');

    res.json({
      success: true,
      companies: companies.map(c => ({ ...c, users_count: parseInt(c.users_count) }))
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

module.exports = router;
