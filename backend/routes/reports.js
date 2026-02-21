const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// ============================================================
// INDIVIDUAL REPORT - PDF for a single participant
// ============================================================
router.post('/individual', auth, async (req, res) => {
  try {
    const { participantEvaluationId } = req.body;

    if (!participantEvaluationId) {
      return res.status(400).json({ error: 'participantEvaluationId es requerido' });
    }

    // Get participant + evaluation + company data
    const participant = await db('participant_evaluations as pe')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .join('evaluations as e', 'pe.evaluation_id', 'e.id')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('pe.id', participantEvaluationId)
      .where('e.company_id', req.user.companyId)
      .select(
        'pe.id as pe_id',
        'pe.status',
        'pe.completed_at',
        'p.email',
        'p.demographic_data',
        'e.name as evaluation_name',
        'e.description as evaluation_description',
        'c.name as company_name',
        'c.nit as company_nit'
      )
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Get pre-calculated results from DB
    const resultRows = await db('results')
      .where('participant_evaluation_id', participantEvaluationId)
      .orderBy('questionnaire_type')
      .select('*');

    if (resultRows.length === 0) {
      return res.status(400).json({ error: 'No hay resultados calculados. Primero calcule los resultados del participante.' });
    }

    // Parse results
    const resultsByType = {};
    resultRows.forEach(row => {
      const parsed = typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []);
      resultsByType[row.questionnaire_type] = parsed;
    });

    // Parse demographic data
    const demo = typeof participant.demographic_data === 'string'
      ? JSON.parse(participant.demographic_data)
      : (participant.demographic_data || {});

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_BRS_Individual_${Date.now()}.pdf`);
    doc.pipe(res);

    generateIndividualPDF(doc, {
      participant,
      demo,
      resultsByType,
    });

    doc.end();

  } catch (error) {
    console.error('Error generating individual report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// ============================================================
// ORGANIZATIONAL REPORT - PDF for an entire evaluation
// ============================================================
router.post('/organizational', auth, async (req, res) => {
  try {
    const { evaluationId } = req.body;

    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    // Get evaluation + company data
    const evaluation = await db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .where('e.company_id', req.user.companyId)
      .select(
        'e.id', 'e.name', 'e.description', 'e.start_date', 'e.end_date', 'e.status',
        'c.name as company_name', 'c.nit as company_nit'
      )
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all results for all participants in this evaluation
    const allResults = await db('results')
      .join('participant_evaluations as pe', 'results.participant_evaluation_id', 'pe.id')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .where('pe.evaluation_id', evaluationId)
      .select('results.*', 'p.demographic_data', 'p.email');

    const totalParticipants = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .count('id as count')
      .first();

    const completedParticipants = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .where('status', 'completed')
      .count('id as count')
      .first();

    // Aggregate stats
    const stats = aggregateOrganizationalStats(allResults);

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_BRS_Organizacional_${Date.now()}.pdf`);
    doc.pipe(res);

    generateOrganizationalPDF(doc, {
      evaluation,
      stats,
      totalParticipants: parseInt(totalParticipants.count),
      completedParticipants: parseInt(completedParticipants.count),
    });

    doc.end();

  } catch (error) {
    console.error('Error generating organizational report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// ============================================================
// PDF GENERATION HELPERS
// ============================================================

const RISK_COLORS = {
  'sin_riesgo': '#10B981',
  'riesgo_bajo': '#3B82F6',
  'riesgo_medio': '#EAB308',
  'riesgo_alto': '#F97316',
  'riesgo_muy_alto': '#EF4444'
};

const RISK_LABELS = {
  'sin_riesgo': 'Sin Riesgo',
  'riesgo_bajo': 'Riesgo Bajo',
  'riesgo_medio': 'Riesgo Medio',
  'riesgo_alto': 'Riesgo Alto',
  'riesgo_muy_alto': 'Riesgo Muy Alto'
};

const QUESTIONNAIRE_TITLES = {
  'intralaboral_a': 'Cuestionario Intralaboral - Forma A',
  'intralaboral_b': 'Cuestionario Intralaboral - Forma B',
  'extralaboral': 'Cuestionario de Factores Extralaborales',
  'estres': 'Cuestionario de Síntomas de Estrés'
};

function formatDimensionName(dim) {
  return dim
    .replace(/^puntaje_total_/, 'Puntaje Total ')
    .replace(/_total$/, ' (Total Dominio)')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ensureSpace(doc, needed) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function drawHorizontalLine(doc) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.5);
}

function drawRiskBar(doc, x, y, width, score, riskLevel) {
  const barHeight = 10;
  // Background
  doc.rect(x, y, width, barHeight).fillColor('#E5E7EB').fill();
  // Filled portion
  const fillWidth = (score / 100) * width;
  doc.rect(x, y, fillWidth, barHeight).fillColor(RISK_COLORS[riskLevel] || '#6B7280').fill();
}

// ============================================================
// INDIVIDUAL PDF
// ============================================================
function generateIndividualPDF(doc, { participant, demo, resultsByType }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;

  // ---- COVER PAGE ----
  doc.moveDown(4);
  doc.fontSize(28).fillColor('#1E40AF').text('REPORTE INDIVIDUAL', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).fillColor('#4B5563').text('Batería de Riesgo Psicosocial', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#6B7280').text('Ministerio de la Protección Social - República de Colombia', { align: 'center' });

  doc.moveDown(3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  // Participant info box
  doc.fontSize(14).fillColor('#1F2937').text('DATOS DEL PARTICIPANTE');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');

  const infoLines = [
    ['Nombre', `${demo.firstName || ''} ${demo.lastName || ''}`.trim() || demo.nombre || participant.email],
    ['Empresa', participant.company_name],
    ['Evaluación', participant.evaluation_name],
    ['Fecha', participant.completed_at ? new Date(participant.completed_at).toLocaleDateString('es-CO') : 'N/A'],
  ];
  if (demo.cargo || demo.position) infoLines.push(['Cargo', demo.cargo || demo.position]);
  if (demo.departamento || demo.department) infoLines.push(['Departamento', demo.departamento || demo.department]);
  if (demo.edad || demo.age) infoLines.push(['Edad', `${demo.edad || demo.age} años`]);
  if (demo.sexo || demo.gender) infoLines.push(['Sexo', demo.sexo || demo.gender]);

  infoLines.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || 'N/A');
  });

  // ---- RESULTS PAGES ----
  for (const [qType, dimensions] of Object.entries(resultsByType)) {
    doc.addPage();
    const title = QUESTIONNAIRE_TITLES[qType] || qType;
    doc.fontSize(16).fillColor('#1E40AF').text(title.toUpperCase());
    doc.moveDown(0.3);
    drawHorizontalLine(doc);
    doc.moveDown(0.5);

    // Separate dimensions, domain totals, and overall totals
    const overallTotals = dimensions.filter(d => d.dimension.startsWith('puntaje_total'));
    const dimResults = dimensions.filter(d => !d.dimension.endsWith('_total') && !d.dimension.startsWith('puntaje_total'));
    const domainResults = dimensions.filter(d => d.dimension.endsWith('_total'));

    // Risk summary for this questionnaire
    const riskCounts = { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    dimResults.forEach(d => { if (riskCounts[d.riskLevel] !== undefined) riskCounts[d.riskLevel]++; });

    doc.fontSize(12).fillColor('#1F2937').text('Resumen de Niveles de Riesgo:');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#374151');
    Object.entries(riskCounts).forEach(([level, count]) => {
      if (count > 0) {
        doc.fillColor(RISK_COLORS[level]).text(`  ● ${RISK_LABELS[level]}: ${count} dimensiones`, { continued: false });
      }
    });
    doc.fillColor('#374151');
    doc.moveDown(1);

    // Domain totals (if any)
    if (domainResults.length > 0) {
      doc.fontSize(12).fillColor('#1F2937').text('Resultados por Dominio:');
      doc.moveDown(0.5);

      domainResults.forEach(d => {
        ensureSpace(doc, 40);
        const name = formatDimensionName(d.dimension);
        const score = d.transformedScore != null ? d.transformedScore.toFixed(1) : '0';
        const risk = RISK_LABELS[d.riskLevel] || d.riskLevel;

        doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold').text(name);
        doc.font('Helvetica').fillColor(RISK_COLORS[d.riskLevel] || '#6B7280')
          .text(`  Puntaje: ${score}%  |  ${risk}`);

        drawRiskBar(doc, m, doc.y + 2, pageW * 0.6, parseFloat(score), d.riskLevel);
        doc.moveDown(1.5);
      });

      doc.moveDown(0.5);
    }

    // Overall total (puntaje total) if present
    if (overallTotals.length > 0) {
      overallTotals.forEach(d => {
        ensureSpace(doc, 50);
        const name = formatDimensionName(d.dimension);
        const score = d.transformedScore != null ? d.transformedScore.toFixed(1) : '0';
        const risk = RISK_LABELS[d.riskLevel] || d.riskLevel;

        doc.fontSize(13).fillColor('#1E40AF').font('Helvetica-Bold').text(name.toUpperCase());
        doc.font('Helvetica').fontSize(11).fillColor(RISK_COLORS[d.riskLevel] || '#6B7280')
          .text(`  Puntaje transformado: ${score}%  |  ${risk}`);

        drawRiskBar(doc, m, doc.y + 2, pageW * 0.7, parseFloat(score), d.riskLevel);
        doc.moveDown(2);
      });
    }

    // Dimension detail table
    doc.fontSize(12).fillColor('#1F2937').text('Detalle por Dimensión:');
    doc.moveDown(0.5);

    // Table header
    const colX = [m, m + 200, m + 290, m + 370];
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Dimensión', colX[0], doc.y);
    doc.text('Puntaje', colX[1], doc.y - doc.currentLineHeight());
    doc.text('Percentil', colX[2], doc.y - doc.currentLineHeight());
    doc.text('Nivel de Riesgo', colX[3], doc.y - doc.currentLineHeight());
    doc.moveDown(0.5);
    drawHorizontalLine(doc);

    dimResults.forEach(d => {
      ensureSpace(doc, 20);
      const y = doc.y;
      const score = d.transformedScore != null ? d.transformedScore.toFixed(1) + '%' : 'N/A';
      const percentile = d.percentile != null ? d.percentile.toFixed(1) : 'N/A';
      const risk = RISK_LABELS[d.riskLevel] || d.riskLevel;

      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      doc.text(formatDimensionName(d.dimension), colX[0], y, { width: 190 });
      doc.text(score, colX[1], y);
      doc.text(percentile, colX[2], y);
      doc.fillColor(RISK_COLORS[d.riskLevel] || '#6B7280').font('Helvetica-Bold');
      doc.text(risk, colX[3], y);
      doc.font('Helvetica').fillColor('#374151');
      doc.moveDown(0.3);
    });
  }

  // ---- INTERPRETATION PAGE ----
  doc.addPage();
  doc.fontSize(16).fillColor('#1E40AF').text('INTERPRETACIÓN Y RECOMENDACIONES');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(
    'Los resultados de esta evaluación de riesgo psicosocial se basan en la metodología oficial ' +
    'del Ministerio de la Protección Social de Colombia (Resolución 2646 de 2008). Cada cuestionario ' +
    'evalúa diferentes aspectos del ambiente laboral y extralaboral que pueden impactar la salud ' +
    'mental y física del trabajador.',
    { width: pageW, align: 'justify' }
  );
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('Significado de los Niveles de Riesgo:');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9);

  const riskDescriptions = [
    ['Sin Riesgo', '#10B981', 'Las condiciones del ambiente de trabajo no representan riesgo para la salud del trabajador.'],
    ['Riesgo Bajo', '#3B82F6', 'Las condiciones de riesgo están presentes de forma leve. Se recomienda mantener sistemas de vigilancia.'],
    ['Riesgo Medio', '#EAB308', 'Las condiciones de riesgo están presentes de forma moderada. Se requieren acciones de intervención a mediano plazo.'],
    ['Riesgo Alto', '#F97316', 'Las condiciones de riesgo están presentes de forma importante. Se requieren acciones de intervención a corto plazo.'],
    ['Riesgo Muy Alto', '#EF4444', 'Las condiciones de riesgo están presentes de forma crítica. Se requieren acciones de intervención inmediatas.'],
  ];

  riskDescriptions.forEach(([label, color, desc]) => {
    ensureSpace(doc, 30);
    doc.fillColor(color).font('Helvetica-Bold').text(`● ${label}: `, { continued: true });
    doc.fillColor('#374151').font('Helvetica').text(desc);
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('Recomendaciones Generales:');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  doc.text(
    'Es importante implementar programas de vigilancia epidemiológica en salud mental y programas ' +
    'de intervención basados en los factores de riesgo identificados. Se recomienda realizar ' +
    'seguimiento periódico y evaluaciones de efectividad de las medidas implementadas.',
    { width: pageW, align: 'justify' }
  );

  // Footer on all pages
  addFooters(doc);
}

// ============================================================
// ORGANIZATIONAL PDF
// ============================================================
function generateOrganizationalPDF(doc, { evaluation, stats, totalParticipants, completedParticipants }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;

  // ---- COVER ----
  doc.moveDown(4);
  doc.fontSize(28).fillColor('#1E40AF').text('REPORTE ORGANIZACIONAL', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).fillColor('#4B5563').text('Batería de Riesgo Psicosocial', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#6B7280').text('Ministerio de la Protección Social - República de Colombia', { align: 'center' });

  doc.moveDown(3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  doc.fontSize(14).fillColor('#1F2937').text('INFORMACIÓN DE LA EVALUACIÓN');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');

  const infoLines = [
    ['Empresa', evaluation.company_name],
    ['NIT', evaluation.company_nit],
    ['Evaluación', evaluation.name],
    ['Descripción', evaluation.description || 'N/A'],
    ['Período', `${fmtDate(evaluation.start_date)} - ${fmtDate(evaluation.end_date)}`],
    ['Total Participantes', String(totalParticipants)],
    ['Participantes Completados', String(completedParticipants)],
    ['Tasa de Completado', totalParticipants > 0 ? `${((completedParticipants / totalParticipants) * 100).toFixed(1)}%` : 'N/A'],
  ];

  infoLines.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || 'N/A');
  });

  // ---- RISK DISTRIBUTION ----
  doc.addPage();
  doc.fontSize(16).fillColor('#1E40AF').text('DISTRIBUCIÓN DE NIVELES DE RIESGO');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  if (stats.riskDistribution) {
    const total = Object.values(stats.riskDistribution).reduce((s, v) => s + v, 0);

    Object.entries(RISK_LABELS).forEach(([key, label]) => {
      const count = stats.riskDistribution[key] || 0;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';

      doc.fontSize(11).fillColor(RISK_COLORS[key]).font('Helvetica-Bold');
      doc.text(`${label}: ${count} dimensiones (${pct}%)`);

      // Visual bar
      drawRiskBar(doc, m, doc.y + 2, pageW * 0.5, parseFloat(pct), key);
      doc.moveDown(1.2);
    });
  }

  // ---- TOP RISK DIMENSIONS ----
  doc.moveDown(1);
  doc.fontSize(16).fillColor('#1E40AF').text('DIMENSIONES CON MAYOR RIESGO');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);

  if (stats.dimensionAverages && stats.dimensionAverages.length > 0) {
    // Sort by average score descending and take top 10
    const topDimensions = [...stats.dimensionAverages]
      .filter(d => !d.dimension.endsWith('_total') && !d.dimension.startsWith('puntaje_total'))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    topDimensions.forEach((d, i) => {
      ensureSpace(doc, 25);
      doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(`${i + 1}. ${formatDimensionName(d.dimension)} (${d.questionnaireType})`);
      doc.font('Helvetica').fillColor('#6B7280');
      doc.text(`   Puntaje promedio: ${d.avgScore.toFixed(1)}% | Riesgo predominante: ${RISK_LABELS[d.predominantRisk] || d.predominantRisk}`);
      doc.moveDown(0.3);
    });
  } else {
    doc.fontSize(10).fillColor('#6B7280').text('No hay datos suficientes para calcular estadísticas.');
  }

  // ---- RECOMMENDATIONS ----
  doc.addPage();
  doc.fontSize(16).fillColor('#1E40AF').text('RECOMENDACIONES ORGANIZACIONALES');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  const highRiskCount = (stats.riskDistribution?.riesgo_alto || 0) + (stats.riskDistribution?.riesgo_muy_alto || 0);
  const totalDims = Object.values(stats.riskDistribution || {}).reduce((s, v) => s + v, 0);
  const highRiskPct = totalDims > 0 ? (highRiskCount / totalDims) * 100 : 0;

  doc.fontSize(10).fillColor('#374151').font('Helvetica');

  if (highRiskPct > 30) {
    doc.fillColor('#EF4444').font('Helvetica-Bold');
    doc.text('PRIORIDAD ALTA: Más del 30% de las dimensiones evaluadas presenta riesgo alto o muy alto.');
    doc.font('Helvetica').fillColor('#374151');
    doc.moveDown(0.5);
    doc.text('Se requiere implementar un programa integral de intervención inmediata que incluya:');
    doc.moveDown(0.3);
    ['Revisión y ajuste de cargas de trabajo',
     'Fortalecimiento de programas de liderazgo',
     'Implementación de estrategias de manejo del estrés',
     'Mejora de los sistemas de comunicación organizacional'
    ].forEach(r => doc.text(`  • ${r}`));
  } else if (highRiskPct > 15) {
    doc.fillColor('#F97316').font('Helvetica-Bold');
    doc.text('PRIORIDAD MEDIA: Entre el 15% y 30% de las dimensiones presenta riesgo elevado.');
    doc.font('Helvetica').fillColor('#374151');
    doc.moveDown(0.5);
    doc.text('Se recomienda implementar medidas preventivas focalizadas en las áreas de mayor riesgo.');
  } else {
    doc.fillColor('#10B981').font('Helvetica-Bold');
    doc.text('SITUACIÓN CONTROLADA: La mayoría de dimensiones presenta niveles de riesgo bajos.');
    doc.font('Helvetica').fillColor('#374151');
    doc.moveDown(0.5);
    doc.text('Mantener programas de vigilancia y prevención existentes.');
  }

  doc.moveDown(1.5);
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('Acciones Recomendadas:');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#374151');

  [
    'Implementar programas de capacitación en manejo del estrés y habilidades de afrontamiento.',
    'Desarrollar estrategias de mejora del clima organizacional y comunicación.',
    'Revisar procesos de trabajo para optimizar cargas y demandas laborales.',
    'Establecer programas de reconocimiento y bienestar laboral.',
    'Crear espacios de participación y retroalimentación para los trabajadores.',
    'Realizar evaluaciones de seguimiento cada 6-12 meses.'
  ].forEach((r, i) => {
    doc.text(`${i + 1}. ${r}`);
    doc.moveDown(0.2);
  });

  addFooters(doc);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function aggregateOrganizationalStats(allResults) {
  const stats = {
    riskDistribution: { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 },
    dimensionAverages: []
  };

  // Collect all dimension scores
  const dimScores = {}; // key: `${qType}_${dimension}` => { scores: [], risks: [] }

  allResults.forEach(row => {
    const parsed = typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []);
    parsed.forEach(d => {
      if (d.riskLevel && stats.riskDistribution[d.riskLevel] !== undefined) {
        stats.riskDistribution[d.riskLevel]++;
      }

      const key = `${row.questionnaire_type}_${d.dimension}`;
      if (!dimScores[key]) {
        dimScores[key] = { questionnaireType: row.questionnaire_type, dimension: d.dimension, scores: [], risks: [] };
      }
      if (d.transformedScore != null) {
        dimScores[key].scores.push(d.transformedScore);
      }
      if (d.riskLevel) {
        dimScores[key].risks.push(d.riskLevel);
      }
    });
  });

  // Calculate averages and predominant risk
  stats.dimensionAverages = Object.values(dimScores).map(entry => {
    const avgScore = entry.scores.length > 0
      ? entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length
      : 0;

    // Find predominant risk level
    const riskCounts = {};
    entry.risks.forEach(r => { riskCounts[r] = (riskCounts[r] || 0) + 1; });
    const predominantRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sin_riesgo';

    return {
      questionnaireType: entry.questionnaireType,
      dimension: entry.dimension,
      avgScore,
      predominantRisk,
      count: entry.scores.length
    };
  });

  return stats;
}

function fmtDate(d) {
  if (!d) return 'N/A';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return 'N/A'; }
}

function addFooters(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#9CA3AF');
    doc.text(
      'Generado por BRS Digital - Batería de Riesgo Psicosocial | Metodología oficial del Ministerio de la Protección Social',
      doc.page.margins.left,
      doc.page.height - 30,
      { width: doc.page.width - doc.page.margins.left * 2, align: 'center' }
    );
    doc.text(
      `Fecha: ${new Date().toLocaleString('es-CO')} | Página ${i + 1} de ${pages.count}`,
      doc.page.margins.left,
      doc.page.height - 20,
      { width: doc.page.width - doc.page.margins.left * 2, align: 'center' }
    );
  }
}

module.exports = router;
