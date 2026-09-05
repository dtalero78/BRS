const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, requireSuperAdmin } = require('../middleware/auth');

router.use(auth, requireSuperAdmin);

router.get('/stats', async (req, res) => {
  try {
    const [users, companies, evaluations, completedRow, paidRow] = await Promise.all([
      db('users').select('role').count('* as c').groupBy('role'),
      db('companies').count('* as c').first(),
      db('evaluations').count('* as c').first(),
      db('participant_evaluations').whereNotNull('completed_at').count('* as c').first(),
      db('evaluations').where('paid', true).count('* as c').first(),
    ]);

    const byRole = users.reduce((acc, r) => { acc[r.role] = parseInt(r.c) || 0; return acc; }, {});

    res.json({
      users: {
        total: (byRole.admin || 0) + (byRole.evaluator || 0) + (byRole.participant || 0),
        admins: byRole.admin || 0,
        evaluators: byRole.evaluator || 0,
        participants: byRole.participant || 0,
      },
      companies: parseInt(companies.c) || 0,
      evaluations: parseInt(evaluations.c) || 0,
      paidEvaluations: parseInt(paidRow.c) || 0,
      completedAssessments: parseInt(completedRow.c) || 0,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/evaluators', async (req, res) => {
  try {
    const rows = await db('users as u')
      .leftJoin('companies as c', 'c.created_by', 'u.id')
      .leftJoin('evaluations as e', 'e.company_id', 'c.id')
      .leftJoin('participant_evaluations as pe', 'pe.evaluation_id', 'e.id')
      .where('u.role', 'evaluator')
      .groupBy('u.id', 'u.email', 'u.active', 'u.created_at')
      .select(
        'u.id',
        'u.email',
        'u.active',
        'u.created_at',
        db.raw('COUNT(DISTINCT c.id) as companies_count'),
        db.raw('COUNT(DISTINCT e.id) as evaluations_count'),
        db.raw('COUNT(DISTINCT pe.id) as participants_count'),
        db.raw('COUNT(DISTINCT CASE WHEN pe.completed_at IS NOT NULL THEN pe.id END) as completed_count'),
        db.raw("COUNT(DISTINCT CASE WHEN e.paid = true THEN e.id END) as paid_count")
      )
      .orderBy('u.created_at', 'desc');

    res.json({
      evaluators: rows.map(r => ({
        id: r.id,
        email: r.email,
        active: r.active,
        createdAt: r.created_at,
        companiesCount: parseInt(r.companies_count) || 0,
        evaluationsCount: parseInt(r.evaluations_count) || 0,
        participantsCount: parseInt(r.participants_count) || 0,
        completedCount: parseInt(r.completed_count) || 0,
        paidCount: parseInt(r.paid_count) || 0,
      })),
    });
  } catch (err) {
    console.error('Admin evaluators error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/evaluations', async (req, res) => {
  try {
    const rows = await db('evaluations as e')
      .leftJoin('companies as c', 'e.company_id', 'c.id')
      .leftJoin('users as u', 'c.created_by', 'u.id')
      .leftJoin('users as pb', 'e.paid_by', 'pb.id')
      .select(
        'e.id',
        'e.name',
        'e.status',
        'e.paid',
        'e.paid_at',
        'e.created_at',
        'c.id as company_id',
        'c.name as company_name',
        'u.email as evaluator_email',
        'pb.email as paid_by_email',
        db.raw('(SELECT COUNT(*) FROM participant_evaluations pe WHERE pe.evaluation_id = e.id) as total_participants'),
        db.raw("(SELECT COUNT(*) FROM participant_evaluations pe WHERE pe.evaluation_id = e.id AND pe.completed_at IS NOT NULL) as completed_participants"),
        // Pagos por prueba (Wompi). Son independientes del interruptor manual
        // `e.paid`: una evaluacion que el cliente pago por la pasarela tiene
        // `paid = false` y sus pruebas con `paid_at`. Sin estas columnas el
        // panel muestra como pendiente algo que ya se cobro.
        db.raw('(SELECT COUNT(*) FROM participant_evaluations pe WHERE pe.evaluation_id = e.id AND pe.paid_at IS NOT NULL) as wompi_paid_count'),
        db.raw('(SELECT MIN(pe.paid_at) FROM participant_evaluations pe WHERE pe.evaluation_id = e.id AND pe.paid_at IS NOT NULL) as wompi_first_paid_at'),
        db.raw('(SELECT MAX(pe.paid_at) FROM participant_evaluations pe WHERE pe.evaluation_id = e.id AND pe.paid_at IS NOT NULL) as wompi_last_paid_at'),
        // Lo efectivamente cobrado por esas pruebas, al precio que tenia la
        // orden (no al precio de hoy): la tarifa puede cambiar despues.
        db.raw(`(SELECT COALESCE(SUM(pay.unit_price_in_cents), 0)
                   FROM participant_evaluations pe
                   JOIN payments pay ON pay.id = pe.payment_id
                  WHERE pe.evaluation_id = e.id AND pe.paid_at IS NOT NULL) as wompi_amount_cents`)
      )
      .orderBy('e.created_at', 'desc');

    res.json({
      evaluations: rows.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        paid: !!r.paid,
        paidAt: r.paid_at,
        paidByEmail: r.paid_by_email,
        wompiPaidCount: parseInt(r.wompi_paid_count) || 0,
        wompiFirstPaidAt: r.wompi_first_paid_at,
        wompiLastPaidAt: r.wompi_last_paid_at,
        wompiAmountCop: Math.round((parseInt(r.wompi_amount_cents) || 0) / 100),
        createdAt: r.created_at,
        companyId: r.company_id,
        companyName: r.company_name,
        evaluatorEmail: r.evaluator_email,
        totalParticipants: parseInt(r.total_participants) || 0,
        completedParticipants: parseInt(r.completed_participants) || 0,
      })),
    });
  } catch (err) {
    console.error('Admin evaluations error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/evaluations/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paid } = req.body;
    if (typeof paid !== 'boolean') {
      return res.status(400).json({ error: 'paid debe ser boolean' });
    }

    const evaluation = await db('evaluations').where('id', id).first();
    if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });

    const update = {
      paid,
      paid_at: paid ? new Date() : null,
      paid_by: paid ? req.user.userId : null,
    };

    await db('evaluations').where('id', id).update(update);

    res.json({ id: parseInt(id), paid, paidAt: update.paid_at });
  } catch (err) {
    console.error('Admin toggle payment error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
