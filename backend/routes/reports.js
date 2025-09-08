const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const calculateResults = require('../utils/calculate-results');

// Generar reporte individual en PDF
router.post('/individual', auth, async (req, res) => {
  try {
    const { participantEvaluationId, includeCharts = true, language = 'es' } = req.body;

    // Obtener datos del participante y resultados
    const participant = await db('participant_evaluations as pe')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .join('evaluations as e', 'pe.evaluation_id', 'e.id')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('pe.id', participantEvaluationId)
      .where('e.company_id', req.user.company_id)
      .select(
        'pe.id',
        'pe.evaluation_id', 
        'pe.participant_id',
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

    // Obtener todas las respuestas y calcular resultados
    const responses = await db('responses')
      .where('participant_evaluation_id', participantEvaluationId)
      .select('questionnaire_type', 'responses', 'completed_at');

    // Calcular resultados para cada cuestionario
    const allResults = {};
    for (const response of responses) {
      try {
        const results = await calculateResults({
          questionnaire_type: response.questionnaire_type,
          responses: response.responses,
          demographic_data: participant.demographic_data
        });
        allResults[response.questionnaire_type] = results;
      } catch (error) {
        console.error(`Error calculating results for ${response.questionnaire_type}:`, error);
      }
    }

    // Generar PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const fileName = `reporte_individual_${participantEvaluationId}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', fileName);

    // Asegurar que el directorio temp existe
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Generar contenido del PDF
    await generateIndividualReport(doc, participant, allResults, includeCharts);

    doc.end();

    // Esperar a que el archivo se complete
    stream.on('finish', () => {
      res.download(filePath, `Reporte_BRS_${participant.email}_${new Date().toISOString().split('T')[0]}.pdf`, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({ error: 'Error al descargar el archivo' });
        }
        // Limpiar archivo temporal después de la descarga
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 60000); // Eliminar después de 1 minuto
      });
    });

  } catch (error) {
    console.error('Error generating individual report:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Generar reporte organizacional en PDF
router.post('/organizational', auth, async (req, res) => {
  try {
    const { evaluationId, includeCharts = true, includeIndividualSummaries = false } = req.body;

    // Obtener datos de la evaluación
    const evaluation = await db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .where('e.company_id', req.user.company_id)
      .select(
        'e.id',
        'e.name',
        'e.description', 
        'e.start_date',
        'e.end_date',
        'e.status',
        'c.name as company_name',
        'c.nit as company_nit',
        'c.contact_email',
        'c.contact_phone'
      )
      .first();
    
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Obtener todos los participantes y sus resultados
    const participants = await db('participant_evaluations as pe')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .where('pe.evaluation_id', evaluationId)
      .where('pe.status', 'completed')
      .select(
        'pe.id as participant_evaluation_id',
        'pe.status',
        'pe.completed_at',
        'p.email',
        'p.demographic_data'
      );

    // Calcular estadísticas organizacionales
    const organizationalStats = await calculateOrganizationalStats(participants);

    // Generar PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const fileName = `reporte_organizacional_${evaluationId}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', fileName);

    // Asegurar que el directorio temp existe
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Generar contenido del PDF
    await generateOrganizationalReport(doc, evaluation, organizationalStats, participants, includeCharts, includeIndividualSummaries);

    doc.end();

    // Esperar a que el archivo se complete
    stream.on('finish', () => {
      res.download(filePath, `Reporte_Organizacional_BRS_${evaluation.name}_${new Date().toISOString().split('T')[0]}.pdf`, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({ error: 'Error al descargar el archivo' });
        }
        // Limpiar archivo temporal después de la descarga
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 60000); // Eliminar después de 1 minuto
      });
    });

  } catch (error) {
    console.error('Error generating organizational report:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Download report - TODO: Implement with PostgreSQL
// router.get('/download/:reportId', verifyToken, async (req, res) => {
//   try {
//     const { reportId } = req.params;
//     res.status(501).json({ error: 'Funcionalidad pendiente de implementar' });
//   } catch (error) {
//     console.error('Download report error:', error);
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }
// });

// Get reports list - TODO: Implement with PostgreSQL  
// router.get('/', verifyToken, async (req, res) => {
//   try {
//     const { evaluationId, type, page = 1, limit = 10 } = req.query;
//     res.status(501).json({ error: 'Funcionalidad pendiente de implementar' });
//   } catch (error) {
//     console.error('Get reports error:', error);
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }
// });

// Función para generar reporte individual
async function generateIndividualReport(doc, participant, results, includeCharts) {
  const pageHeight = doc.page.height;
  const margin = 50;
  let currentY = margin;

  // Header con logo y título
  doc.fontSize(24).text('REPORTE INDIVIDUAL BRS', margin, currentY, { align: 'center' });
  currentY += 50;
  
  doc.fontSize(18).text('Batería de Riesgo Psicosocial', margin, currentY, { align: 'center' });
  currentY += 30;

  doc.fontSize(12).text('Ministerio de la Protección Social - República de Colombia', margin, currentY, { align: 'center' });
  currentY += 50;

  // Información del participante
  doc.fontSize(16).text('INFORMACIÓN DEL PARTICIPANTE', margin, currentY);
  currentY += 25;

  const demographicData = participant.demographic_data || {};
  
  doc.fontSize(12);
  doc.text(`Email: ${participant.email}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Empresa: ${participant.company_name}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Evaluación: ${participant.evaluation_name}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Fecha de Evaluación: ${participant.completed_at ? new Date(participant.completed_at).toLocaleDateString('es-ES') : 'N/A'}`, margin, currentY);
  currentY += 20;

  if (demographicData.edad) {
    doc.text(`Edad: ${demographicData.edad} años`, margin, currentY);
    currentY += 20;
  }

  if (demographicData.sexo) {
    doc.text(`Sexo: ${demographicData.sexo}`, margin, currentY);
    currentY += 20;
  }

  if (demographicData.cargo) {
    doc.text(`Cargo: ${demographicData.cargo}`, margin, currentY);
    currentY += 20;
  }

  currentY += 30;

  // Resultados por cuestionario
  doc.fontSize(16).text('RESULTADOS DE EVALUACIÓN', margin, currentY);
  currentY += 25;

  for (const [questionnaireType, questionnaireResults] of Object.entries(results)) {
    if (currentY > pageHeight - 200) {
      doc.addPage();
      currentY = margin;
    }

    const title = getQuestionnaireTitle(questionnaireType);
    doc.fontSize(14).text(title.toUpperCase(), margin, currentY);
    currentY += 20;

    // Nivel de riesgo general
    const generalRisk = questionnaireResults.general_risk_level || 'sin_riesgo';
    const generalScore = questionnaireResults.general_score || 0;
    
    doc.fontSize(12);
    doc.fillColor(getRiskColor(generalRisk));
    doc.text(`Nivel de Riesgo General: ${formatRiskLevel(generalRisk)} (${generalScore.toFixed(1)}%)`, margin, currentY);
    doc.fillColor('black');
    currentY += 25;

    // Resultados por dominio
    if (questionnaireResults.domains) {
      doc.text('Resultados por Dominio:', margin, currentY);
      currentY += 15;

      for (const [domain, domainData] of Object.entries(questionnaireResults.domains)) {
        doc.fontSize(10);
        const domainScore = domainData.score || 0;
        const domainRisk = domainData.risk_level || 'sin_riesgo';
        
        doc.fillColor(getRiskColor(domainRisk));
        doc.text(`• ${formatDomainName(domain)}: ${formatRiskLevel(domainRisk)} (${domainScore.toFixed(1)}%)`, margin + 20, currentY);
        doc.fillColor('black');
        currentY += 12;
      }
    }

    currentY += 20;
  }

  // Interpretación y recomendaciones
  if (currentY > pageHeight - 300) {
    doc.addPage();
    currentY = margin;
  }

  doc.fontSize(16).text('INTERPRETACIÓN Y RECOMENDACIONES', margin, currentY);
  currentY += 25;

  const interpretation = generateInterpretation(results);
  doc.fontSize(11).text(interpretation, margin, currentY, { width: doc.page.width - 2 * margin, align: 'justify' });
  currentY += 200;

  // Footer
  doc.fontSize(8).fillColor('gray');
  doc.text('Este reporte ha sido generado automáticamente por el Sistema BRS Digital', margin, doc.page.height - 50, { 
    width: doc.page.width - 2 * margin, 
    align: 'center' 
  });
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, margin, doc.page.height - 35, { 
    width: doc.page.width - 2 * margin, 
    align: 'center' 
  });
}

// Función para generar reporte organizacional
async function generateOrganizationalReport(doc, evaluation, stats, participants, includeCharts, includeIndividualSummaries) {
  const pageHeight = doc.page.height;
  const margin = 50;
  let currentY = margin;

  // Header
  doc.fontSize(24).text('REPORTE ORGANIZACIONAL BRS', margin, currentY, { align: 'center' });
  currentY += 50;
  
  doc.fontSize(18).text('Batería de Riesgo Psicosocial', margin, currentY, { align: 'center' });
  currentY += 30;

  doc.fontSize(12).text('Ministerio de la Protección Social - República de Colombia', margin, currentY, { align: 'center' });
  currentY += 50;

  // Información de la empresa
  doc.fontSize(16).text('INFORMACIÓN DE LA EVALUACIÓN', margin, currentY);
  currentY += 25;

  doc.fontSize(12);
  doc.text(`Empresa: ${evaluation.company_name}`, margin, currentY);
  currentY += 20;
  
  doc.text(`NIT: ${evaluation.company_nit}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Evaluación: ${evaluation.name}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Descripción: ${evaluation.description || 'N/A'}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Período: ${new Date(evaluation.start_date).toLocaleDateString('es-ES')} - ${new Date(evaluation.end_date).toLocaleDateString('es-ES')}`, margin, currentY);
  currentY += 20;
  
  doc.text(`Participantes Evaluados: ${participants.length}`, margin, currentY);
  currentY += 40;

  // Estadísticas generales
  doc.fontSize(16).text('ESTADÍSTICAS GENERALES', margin, currentY);
  currentY += 25;

  doc.fontSize(12);
  if (stats.riskDistribution) {
    doc.text('Distribución de Niveles de Riesgo:', margin, currentY);
    currentY += 15;

    for (const [level, count] of Object.entries(stats.riskDistribution)) {
      const percentage = participants.length > 0 ? ((count / participants.length) * 100).toFixed(1) : 0;
      doc.fillColor(getRiskColor(level));
      doc.text(`• ${formatRiskLevel(level)}: ${count} participantes (${percentage}%)`, margin + 20, currentY);
      doc.fillColor('black');
      currentY += 15;
    }
  }

  currentY += 30;

  // Recomendaciones organizacionales
  if (currentY > pageHeight - 300) {
    doc.addPage();
    currentY = margin;
  }

  doc.fontSize(16).text('RECOMENDACIONES ORGANIZACIONALES', margin, currentY);
  currentY += 25;

  const orgRecommendations = generateOrganizationalRecommendations(stats);
  doc.fontSize(11).text(orgRecommendations, margin, currentY, { width: doc.page.width - 2 * margin, align: 'justify' });

  // Footer
  doc.fontSize(8).fillColor('gray');
  doc.text('Este reporte ha sido generado automáticamente por el Sistema BRS Digital', margin, doc.page.height - 50, { 
    width: doc.page.width - 2 * margin, 
    align: 'center' 
  });
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, margin, doc.page.height - 35, { 
    width: doc.page.width - 2 * margin, 
    align: 'center' 
  });
}

// Función para calcular estadísticas organizacionales
async function calculateOrganizationalStats(participants) {
  const stats = {
    totalParticipants: participants.length,
    riskDistribution: {
      sin_riesgo: 0,
      riesgo_bajo: 0,
      riesgo_medio: 0,
      riesgo_alto: 0,
      riesgo_muy_alto: 0
    },
    averageScores: {},
    domainStats: {}
  };

  for (const participant of participants) {
    try {
      // Obtener respuestas del participante
      const responsesResult = await db('responses')
        .where('participant_evaluation_id', participant.participant_evaluation_id)
        .select('questionnaire_type', 'responses');
      
      for (const response of responsesResult) {
        const results = await calculateResults({
          questionnaire_type: response.questionnaire_type,
          responses: response.responses,
          demographic_data: participant.demographic_data
        });

        // Contar distribución de riesgo
        const generalRisk = results.general_risk_level || 'sin_riesgo';
        stats.riskDistribution[generalRisk]++;
      }
    } catch (error) {
      console.error(`Error processing participant ${participant.participant_evaluation_id}:`, error);
    }
  }

  return stats;
}

// Funciones auxiliares
function getQuestionnaireTitle(type) {
  const titles = {
    'forma_a': 'Cuestionario Intralaboral Forma A',
    'forma_b': 'Cuestionario Intralaboral Forma B', 
    'extralaboral': 'Cuestionario de Factores Extralaborales',
    'estres': 'Cuestionario de Síntomas de Estrés'
  };
  return titles[type] || type;
}

function formatRiskLevel(level) {
  const levels = {
    'sin_riesgo': 'Sin Riesgo',
    'riesgo_bajo': 'Riesgo Bajo',
    'riesgo_medio': 'Riesgo Medio', 
    'riesgo_alto': 'Riesgo Alto',
    'riesgo_muy_alto': 'Riesgo Muy Alto'
  };
  return levels[level] || level;
}

function formatDomainName(domain) {
  const domains = {
    'liderazgo_relaciones_sociales': 'Liderazgo y Relaciones Sociales',
    'control': 'Control',
    'demandas_trabajo': 'Demandas del Trabajo',
    'recompensas': 'Recompensas'
  };
  return domains[domain] || domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getRiskColor(level) {
  const colors = {
    'sin_riesgo': '#10B981',
    'riesgo_bajo': '#3B82F6', 
    'riesgo_medio': '#F59E0B',
    'riesgo_alto': '#FB923C',
    'riesgo_muy_alto': '#EF4444'
  };
  return colors[level] || '#6B7280';
}

function generateInterpretation(results) {
  let interpretation = 'INTERPRETACIÓN DE RESULTADOS:\n\n';
  
  interpretation += 'Los resultados de esta evaluación de riesgo psicosocial se basan en la metodología oficial del Ministerio de la Protección Social de Colombia (Resolución 2646 de 2008). ';
  interpretation += 'Cada cuestionario evalúa diferentes aspectos del ambiente laboral y extralaboral que pueden impactar la salud mental y física del trabajador.\n\n';
  
  interpretation += 'SIGNIFICADO DE LOS NIVELES DE RIESGO:\n\n';
  interpretation += '• SIN RIESGO o RIESGO DESPRECIABLE: Las condiciones del ambiente de trabajo no representan riesgo para la salud del trabajador.\n\n';
  interpretation += '• RIESGO BAJO: Las condiciones de riesgo están presentes de forma leve. Se recomienda mantener sistemas de vigilancia.\n\n';
  interpretation += '• RIESGO MEDIO: Las condiciones de riesgo están presentes de forma moderada. Se requieren acciones de intervención a mediano plazo.\n\n';
  interpretation += '• RIESGO ALTO: Las condiciones de riesgo están presentes de forma importante. Se requieren acciones de intervención a corto plazo.\n\n';
  interpretation += '• RIESGO MUY ALTO: Las condiciones de riesgo están presentes de forma crítica. Se requieren acciones de intervención inmediatas.\n\n';
  
  interpretation += 'RECOMENDACIONES GENERALES:\n\n';
  interpretation += 'Es importante implementar programas de vigilancia epidemiológica en salud mental y programas de intervención basados en los factores de riesgo identificados. ';
  interpretation += 'Se recomienda realizar seguimiento periódico y evaluaciones de efectividad de las medidas implementadas.';
  
  return interpretation;
}

function generateOrganizationalRecommendations(stats) {
  let recommendations = 'RECOMENDACIONES BASADAS EN LOS RESULTADOS ORGANIZACIONALES:\n\n';
  
  const totalParticipants = stats.totalParticipants;
  const riskDist = stats.riskDistribution;
  
  const highRiskCount = (riskDist.riesgo_alto || 0) + (riskDist.riesgo_muy_alto || 0);
  const highRiskPercentage = totalParticipants > 0 ? (highRiskCount / totalParticipants) * 100 : 0;
  
  if (highRiskPercentage > 30) {
    recommendations += '⚠️ PRIORIDAD ALTA: Más del 30% de los trabajadores presenta niveles de riesgo alto o muy alto. ';
    recommendations += 'Se requiere implementar un programa integral de intervención inmediata que incluya:\n';
    recommendations += '• Revisión y ajuste de cargas de trabajo\n';
    recommendations += '• Fortalecimiento de programas de liderazgo\n';
    recommendations += '• Implementación de estrategias de manejo del estrés\n';
    recommendations += '• Mejora de los sistemas de comunicación organizacional\n\n';
  } else if (highRiskPercentage > 15) {
    recommendations += '⚠️ PRIORIDAD MEDIA: Entre el 15% y 30% de los trabajadores presenta niveles de riesgo elevado. ';
    recommendations += 'Se recomienda implementar medidas preventivas focalizadas.\n\n';
  } else {
    recommendations += '✅ SITUACIÓN CONTROLADA: La mayoría de trabajadores presenta niveles de riesgo bajos. ';
    recommendations += 'Mantener programas de vigilancia y prevención.\n\n';
  }
  
  recommendations += 'ACCIONES RECOMENDADAS:\n\n';
  recommendations += '1. Implementar programas de capacitación en manejo del estrés y habilidades de afrontamiento.\n';
  recommendations += '2. Desarrollar estrategias de mejora del clima organizacional y comunicación.\n';
  recommendations += '3. Revisar procesos de trabajo para optimizar cargas y demandas laborales.\n';
  recommendations += '4. Establecer programas de reconocimiento y bienestar laboral.\n';
  recommendations += '5. Crear espacios de participación y retroalimentación para los trabajadores.\n\n';
  
  recommendations += 'SEGUIMIENTO:\n\n';
  recommendations += 'Se recomienda realizar evaluaciones de seguimiento cada 6-12 meses para monitorear la efectividad de las intervenciones implementadas.';
  
  return recommendations;
}

module.exports = router;