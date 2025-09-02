const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');
const generateReport = require('../utils/generate-report');

// Generate individual report
router.post('/individual/:participantId', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { participantId } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*', 'evaluations.name as evaluation_name')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Check if participant has completed the evaluation
    if (participant.status !== 'completed') {
      return res.status(400).json({ error: 'El participante no ha completado la evaluación' });
    }

    // Get results
    const results = await db('results')
      .where('participant_id', participantId)
      .select('*');

    if (results.length === 0) {
      return res.status(400).json({ error: 'No hay resultados calculados para este participante' });
    }

    // Generate PDF report
    const reportData = {
      participant: {
        firstName: participant.first_name,
        lastName: participant.last_name,
        documentType: participant.document_type,
        documentNumber: participant.document_number,
        department: participant.department,
        position: participant.position,
        evaluationName: participant.evaluation_name
      },
      results: results.map(result => ({
        dimension: result.dimension,
        questionnaireType: result.questionnaire_type,
        rawScore: result.raw_score,
        transformedScore: result.transformed_score,
        percentile: result.percentile,
        riskLevel: result.risk_level
      })),
      generatedAt: new Date()
    };

    const reportBuffer = await generateReport('individual', reportData);
    const fileName = `reporte_individual_${participant.first_name}_${participant.last_name}_${Date.now()}.pdf`;
    const filePath = `uploads/reports/${fileName}`;

    // Save file
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads/reports');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(__dirname, '../', filePath), reportBuffer);

    // Save report record
    const [report] = await db('reports').insert({
      evaluation_id: participant.evaluation_id,
      participant_id: participantId,
      report_type: 'individual',
      file_path: filePath,
      file_name: fileName,
      generated_by: req.user.userId,
      parameters: JSON.stringify({ participantId })
    }).returning('*');

    // Log report generation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'generate_individual_report',
      entity_type: 'participant',
      entity_id: participantId,
      details: { fileName }
    });

    res.json({
      message: 'Reporte generado exitosamente',
      report: {
        id: report.id,
        fileName: report.file_name,
        filePath: report.file_path,
        generatedAt: report.generated_at
      }
    });

  } catch (error) {
    console.error('Generate individual report error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Generate organizational report
router.post('/organizational/:evaluationId', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { evaluationId } = req.params;

    // Check if evaluation belongs to company
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .where('company_id', req.user.companyId)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all participants and results
    const participants = await db('participants')
      .where('evaluation_id', evaluationId)
      .select('*');

    const results = await db('results')
      .join('participants', 'results.participant_id', 'participants.id')
      .where('participants.evaluation_id', evaluationId)
      .select('results.*', 'participants.first_name', 'participants.last_name', 'participants.department');

    if (results.length === 0) {
      return res.status(400).json({ error: 'No hay resultados calculados para esta evaluación' });
    }

    // Calculate organizational statistics
    const statistics = {};
    results.forEach(result => {
      const key = `${result.questionnaire_type}_${result.dimension}`;
      
      if (!statistics[key]) {
        statistics[key] = {
          dimension: result.dimension,
          questionnaireType: result.questionnaire_type,
          riskLevels: { 'sin_riesgo': 0, 'riesgo_bajo': 0, 'riesgo_medio': 0, 'riesgo_alto': 0, 'riesgo_muy_alto': 0 },
          totalParticipants: 0,
          averageScore: 0,
          scores: []
        };
      }

      statistics[key].riskLevels[result.risk_level]++;
      statistics[key].totalParticipants++;
      statistics[key].scores.push(result.transformed_score);
    });

    Object.values(statistics).forEach(stat => {
      stat.averageScore = stat.scores.reduce((sum, score) => sum + score, 0) / stat.scores.length;
      delete stat.scores;
    });

    // Generate PDF report
    const reportData = {
      evaluation: {
        name: evaluation.name,
        startDate: evaluation.start_date,
        endDate: evaluation.end_date,
        totalParticipants: evaluation.total_participants,
        completedParticipants: evaluation.completed_participants
      },
      statistics: Object.values(statistics),
      generatedAt: new Date()
    };

    const reportBuffer = await generateReport('organizational', reportData);
    const fileName = `reporte_organizacional_${evaluation.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const filePath = `uploads/reports/${fileName}`;

    // Save file
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads/reports');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(__dirname, '../', filePath), reportBuffer);

    // Save report record
    const [report] = await db('reports').insert({
      evaluation_id: evaluationId,
      participant_id: null,
      report_type: 'organizational',
      file_path: filePath,
      file_name: fileName,
      generated_by: req.user.userId,
      parameters: JSON.stringify({ evaluationId })
    }).returning('*');

    // Log report generation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'generate_organizational_report',
      entity_type: 'evaluation',
      entity_id: evaluationId,
      details: { fileName }
    });

    res.json({
      message: 'Reporte organizacional generado exitosamente',
      report: {
        id: report.id,
        fileName: report.file_name,
        filePath: report.file_path,
        generatedAt: report.generated_at
      }
    });

  } catch (error) {
    console.error('Generate organizational report error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Download report
router.get('/download/:reportId', auth, async (req, res) => {
  try {
    const { reportId } = req.params;

    // Get report info
    const report = await db('reports')
      .join('evaluations', 'reports.evaluation_id', 'evaluations.id')
      .where('reports.id', reportId)
      .where('evaluations.company_id', req.user.companyId)
      .select('reports.*')
      .first();

    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../', report.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Log download
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'download_report',
      entity_type: 'report',
      entity_id: reportId,
      details: { fileName: report.file_name }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.file_name}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get reports list
router.get('/', auth, async (req, res) => {
  try {
    const { evaluationId, type, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('reports')
      .join('evaluations', 'reports.evaluation_id', 'evaluations.id')
      .where('evaluations.company_id', req.user.companyId)
      .orderBy('reports.generated_at', 'desc');

    if (evaluationId) {
      query = query.where('reports.evaluation_id', evaluationId);
    }

    if (type) {
      query = query.where('reports.report_type', type);
    }

    const reports = await query
      .limit(limit)
      .offset(offset)
      .select(
        'reports.*',
        'evaluations.name as evaluation_name',
        db.raw('CASE WHEN reports.participant_id IS NOT NULL THEN (SELECT CONCAT(first_name, \' \', last_name) FROM participants WHERE id = reports.participant_id) ELSE NULL END as participant_name')
      );

    const totalQuery = db('reports')
      .join('evaluations', 'reports.evaluation_id', 'evaluations.id')
      .where('evaluations.company_id', req.user.companyId);

    if (evaluationId) totalQuery.where('reports.evaluation_id', evaluationId);
    if (type) totalQuery.where('reports.report_type', type);

    const [{ count }] = await totalQuery.count('* as count');

    res.json({
      reports: reports.map(report => ({
        id: report.id,
        evaluationId: report.evaluation_id,
        evaluationName: report.evaluation_name,
        participantId: report.participant_id,
        participantName: report.participant_name,
        reportType: report.report_type,
        fileName: report.file_name,
        generatedAt: report.generated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;