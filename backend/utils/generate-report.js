const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Risk level colors and descriptions
const RISK_LEVELS = {
  sin_riesgo: {
    color: '#22c55e',
    label: 'Sin riesgo',
    description: 'No se requiere intervención específica'
  },
  riesgo_bajo: {
    color: '#eab308',
    label: 'Riesgo bajo',
    description: 'Se recomienda seguimiento preventivo'
  },
  riesgo_medio: {
    color: '#f97316',
    label: 'Riesgo medio',
    description: 'Se requiere intervención específica'
  },
  riesgo_alto: {
    color: '#ef4444',
    label: 'Riesgo alto',
    description: 'Se requiere intervención inmediata'
  },
  riesgo_muy_alto: {
    color: '#991b1b',
    label: 'Riesgo muy alto',
    description: 'Se requiere intervención urgente'
  }
};

// Individual report template
const INDIVIDUAL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reporte Individual BRS</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 24px;
        }
        .participant-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .participant-info h2 {
            color: #1e40af;
            margin-top: 0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #64748b;
        }
        .results-section {
            margin-bottom: 30px;
        }
        .results-section h2 {
            color: #1e40af;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }
        .result-item {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .dimension-name {
            font-weight: bold;
            font-size: 16px;
            color: #1f2937;
            text-transform: capitalize;
        }
        .risk-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
            color: white;
        }
        .score-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            text-align: center;
        }
        .score-item {
            padding: 10px;
            background: #f8fafc;
            border-radius: 6px;
        }
        .score-value {
            font-size: 20px;
            font-weight: bold;
            color: #1e40af;
        }
        .score-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
        }
        .recommendations {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        .recommendations h3 {
            color: #92400e;
            margin-top: 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .result-item { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Reporte Individual - Batería de Riesgo Psicosocial</h1>
        <p>{{participant.evaluationName}}</p>
    </div>

    <div class="participant-info">
        <h2>Información del Participante</h2>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Nombre:</span>
                {{participant.firstName}} {{participant.lastName}}
            </div>
            <div class="info-item">
                <span class="info-label">Documento:</span>
                {{participant.documentType}} {{participant.documentNumber}}
            </div>
            <div class="info-item">
                <span class="info-label">Área:</span>
                {{participant.department}}
            </div>
            <div class="info-item">
                <span class="info-label">Cargo:</span>
                {{participant.position}}
            </div>
        </div>
    </div>

    {{#each resultsByType}}
    <div class="results-section">
        <h2>{{@key}}</h2>
        {{#each this}}
        <div class="result-item">
            <div class="result-header">
                <div class="dimension-name">{{dimension}}</div>
                <div class="risk-badge" style="background-color: {{riskColor}}">
                    {{riskLabel}}
                </div>
            </div>
            <div class="score-grid">
                <div class="score-item">
                    <div class="score-value">{{rawScore}}</div>
                    <div class="score-label">Puntaje Bruto</div>
                </div>
                <div class="score-item">
                    <div class="score-value">{{transformedScore}}</div>
                    <div class="score-label">Puntaje Transformado</div>
                </div>
                <div class="score-item">
                    <div class="score-value">{{percentile}}</div>
                    <div class="score-label">Percentil</div>
                </div>
            </div>
        </div>
        {{/each}}
    </div>
    {{/each}}

    <div class="recommendations">
        <h3>Recomendaciones Generales</h3>
        <p>Basado en los resultados obtenidos, se recomienda:</p>
        <ul>
            {{#each recommendations}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
    </div>

    <div class="footer">
        <p>Reporte generado el {{generatedAt}}</p>
        <p>Batería de Riesgo Psicosocial - Ministerio de la Protección Social de Colombia</p>
    </div>
</body>
</html>
`;

// Organizational report template
const ORGANIZATIONAL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reporte Organizacional BRS</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 28px;
        }
        .summary {
            background: #f8fafc;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            text-align: center;
        }
        .summary-item {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .summary-value {
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
        }
        .summary-label {
            color: #64748b;
            font-size: 14px;
        }
        .dimension-stats {
            margin-bottom: 30px;
        }
        .dimension-item {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .dimension-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .dimension-name {
            font-weight: bold;
            font-size: 18px;
            color: #1f2937;
            text-transform: capitalize;
        }
        .average-score {
            font-size: 16px;
            font-weight: bold;
            color: #2563eb;
        }
        .risk-distribution {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-top: 15px;
        }
        .risk-item {
            text-align: center;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
        }
        .risk-count {
            font-size: 18px;
        }
        .risk-label {
            font-size: 11px;
            margin-top: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Reporte Organizacional - Batería de Riesgo Psicosocial</h1>
        <h2>{{evaluation.name}}</h2>
    </div>

    <div class="summary">
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">{{evaluation.totalParticipants}}</div>
                <div class="summary-label">Total Participantes</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{evaluation.completedParticipants}}</div>
                <div class="summary-label">Evaluaciones Completadas</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{completionRate}}%</div>
                <div class="summary-label">Tasa de Completitud</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{totalDimensions}}</div>
                <div class="summary-label">Dimensiones Evaluadas</div>
            </div>
        </div>
    </div>

    <div class="dimension-stats">
        <h2>Resultados por Dimensión</h2>
        {{#each statistics}}
        <div class="dimension-item">
            <div class="dimension-header">
                <div class="dimension-name">{{dimension}}</div>
                <div class="average-score">Promedio: {{averageScore}}</div>
            </div>
            <div class="risk-distribution">
                <div class="risk-item" style="background-color: #22c55e">
                    <div class="risk-count">{{riskLevels.sin_riesgo}}</div>
                    <div class="risk-label">Sin Riesgo</div>
                </div>
                <div class="risk-item" style="background-color: #eab308">
                    <div class="risk-count">{{riskLevels.riesgo_bajo}}</div>
                    <div class="risk-label">Riesgo Bajo</div>
                </div>
                <div class="risk-item" style="background-color: #f97316">
                    <div class="risk-count">{{riskLevels.riesgo_medio}}</div>
                    <div class="risk-label">Riesgo Medio</div>
                </div>
                <div class="risk-item" style="background-color: #ef4444">
                    <div class="risk-count">{{riskLevels.riesgo_alto}}</div>
                    <div class="risk-label">Riesgo Alto</div>
                </div>
                <div class="risk-item" style="background-color: #991b1b">
                    <div class="risk-count">{{riskLevels.riesgo_muy_alto}}</div>
                    <div class="risk-label">Riesgo Muy Alto</div>
                </div>
            </div>
        </div>
        {{/each}}
    </div>

    <div class="footer">
        <p>Reporte generado el {{generatedAt}}</p>
        <p>Batería de Riesgo Psicosocial - Ministerio de la Protección Social de Colombia</p>
    </div>
</body>
</html>
`;

// Generate individual report
async function generateIndividualReport(data) {
  // Process results by questionnaire type
  const resultsByType = {};
  const recommendations = [];

  data.results.forEach(result => {
    const type = result.questionnaireType === 'intralaboral_a' ? 'Factores Intralaborales' :
                 result.questionnaireType === 'intralaboral_b' ? 'Factores Intralaborales' :
                 result.questionnaireType === 'extralaboral' ? 'Factores Extralaborales' :
                 result.questionnaireType === 'stress' ? 'Estrés Ocupacional' : result.questionnaireType;

    if (!resultsByType[type]) {
      resultsByType[type] = [];
    }

    const riskInfo = RISK_LEVELS[result.riskLevel] || RISK_LEVELS.riesgo_medio;

    resultsByType[type].push({
      ...result,
      dimension: result.dimension.replace(/_/g, ' '),
      riskColor: riskInfo.color,
      riskLabel: riskInfo.label
    });

    // Add recommendations based on risk level
    if (result.riskLevel === 'riesgo_alto' || result.riskLevel === 'riesgo_muy_alto') {
      recommendations.push(`Intervenir en ${result.dimension.replace(/_/g, ' ')} - ${riskInfo.description}`);
    }
  });

  // Default recommendations if none added
  if (recommendations.length === 0) {
    recommendations.push('Mantener seguimiento preventivo de los factores evaluados');
    recommendations.push('Implementar programas de promoción de la salud mental');
  }

  const templateData = {
    ...data,
    resultsByType,
    recommendations,
    generatedAt: data.generatedAt.toLocaleDateString('es-CO')
  };

  const template = handlebars.compile(INDIVIDUAL_TEMPLATE);
  const html = template(templateData);

  return await generatePDF(html);
}

// Generate organizational report
async function generateOrganizationalReport(data) {
  const completionRate = data.evaluation.totalParticipants > 0 
    ? Math.round((data.evaluation.completedParticipants / data.evaluation.totalParticipants) * 100)
    : 0;

  // Format statistics
  const formattedStats = data.statistics.map(stat => ({
    ...stat,
    dimension: stat.dimension.replace(/_/g, ' '),
    averageScore: Math.round(stat.averageScore * 10) / 10 // Round to 1 decimal
  }));

  const templateData = {
    ...data,
    statistics: formattedStats,
    completionRate,
    totalDimensions: data.statistics.length,
    generatedAt: data.generatedAt.toLocaleDateString('es-CO')
  };

  const template = handlebars.compile(ORGANIZATIONAL_TEMPLATE);
  const html = template(templateData);

  return await generatePDF(html);
}

// Generate PDF from HTML
async function generatePDF(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

// Main function
async function generateReport(type, data) {
  switch (type) {
    case 'individual':
      return await generateIndividualReport(data);
    
    case 'organizational':
      return await generateOrganizationalReport(data);
    
    default:
      throw new Error(`Tipo de reporte no soportado: ${type}`);
  }
}

module.exports = generateReport;