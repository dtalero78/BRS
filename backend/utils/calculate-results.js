const db = require('../config/database');
const { BAREMOS_BRS, getRiskLevel, getBaremos } = require('./baremos-completos');

// Risk level definitions
const RISK_LEVELS = {
  SIN_RIESGO: 'sin_riesgo',
  RIESGO_BAJO: 'riesgo_bajo',
  RIESGO_MEDIO: 'riesgo_medio',
  RIESGO_ALTO: 'riesgo_alto',
  RIESGO_MUY_ALTO: 'riesgo_muy_alto'
};

// Transform raw score to percentage (0-100 scale) - FORMULA OFICIAL BRS
function transformScore(rawScore, maxScore) {
  // Fórmula oficial BRS: (Puntaje obtenido / Puntaje máximo posible) * 100
  return Math.round((rawScore / maxScore) * 100 * 100) / 100; // Redondear a 2 decimales
}

// Calculate percentile based on transformed score - METODOLOGÍA BRS
function calculatePercentile(transformedScore, dimension, forma) {
  // En el sistema BRS, el percentil es equivalente al puntaje transformado
  // ya que los baremos están expresados en escala 0-100
  return Math.min(Math.max(transformedScore, 0), 100);
}

// MAPEO COMPLETO DE DIMENSIONES FORMA A - OFICIAL BRS
const FORMA_A_DIMENSIONS = {
  // DOMINIO: DEMANDAS DEL TRABAJO
  'demandas_ambientales': { 
    questions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 
    domain: 'demandas_trabajo', 
    maxScore: 48,
    baremoKey: 'demandas_ambientales'
  },
  'demandas_cuantitativas': { 
    questions: [13, 14, 15], 
    domain: 'demandas_trabajo', 
    maxScore: 12,
    baremoKey: 'demandas_cuantitativas'
  },
  'demandas_carga_mental': { 
    questions: [16, 17, 18, 19, 20, 21], 
    domain: 'demandas_trabajo', 
    maxScore: 24,
    baremoKey: 'demandas_carga_mental'
  },
  'demandas_emocionales': { 
    questions: [22, 23, 24, 25, 26, 27, 28, 29, 30], 
    domain: 'demandas_trabajo', 
    maxScore: 36,
    baremoKey: 'demandas_emocionales'
  },
  'exigencias_responsabilidad': { 
    questions: [31, 32, 33, 34, 35, 36, 37, 38], 
    domain: 'demandas_trabajo', 
    maxScore: 32,
    baremoKey: 'exigencias_responsabilidad'
  },
  'demandas_jornada': { 
    questions: [39, 40, 41, 42], 
    domain: 'demandas_trabajo', 
    maxScore: 16,
    baremoKey: 'demandas_jornada'
  },
  'consistencia_rol': { 
    questions: [43, 44, 45, 46, 47], 
    domain: 'demandas_trabajo', 
    maxScore: 20,
    baremoKey: 'consistencia_rol'
  },
  'influencia_trabajo_entorno': { 
    questions: [48, 49, 50, 51], 
    domain: 'demandas_trabajo', 
    maxScore: 16,
    baremoKey: 'influencia_trabajo_entorno'
  },
  
  // DOMINIO: CONTROL SOBRE EL TRABAJO
  'control_autonomia': { 
    questions: [52, 53, 54, 55, 56, 57, 58, 59], 
    domain: 'control_trabajo', 
    maxScore: 32,
    baremoKey: 'control_autonomia'
  },
  'oportunidades_desarrollo': { 
    questions: [60, 61, 62, 63], 
    domain: 'control_trabajo', 
    maxScore: 16,
    baremoKey: 'oportunidades_desarrollo'
  },
  'participacion_manejo_cambio': { 
    questions: [64, 65, 66], 
    domain: 'control_trabajo', 
    maxScore: 12,
    baremoKey: 'participacion_manejo_cambio'
  },
  'claridad_rol': { 
    questions: [67, 68, 69, 70, 71], 
    domain: 'control_trabajo', 
    maxScore: 20,
    baremoKey: 'claridad_rol'
  },
  'capacitacion': { 
    questions: [72, 73, 74], 
    domain: 'control_trabajo', 
    maxScore: 12,
    baremoKey: 'capacitacion'
  },
  
  // DOMINIO: LIDERAZGO Y RELACIONES SOCIALES EN EL TRABAJO
  'caracteristicas_liderazgo': { 
    questions: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 52,
    baremoKey: 'caracteristicas_liderazgo'
  },
  'relaciones_sociales_trabajo': { 
    questions: [88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 44,
    baremoKey: 'relaciones_sociales_trabajo'
  },
  'retroalimentacion_desempeño': { 
    questions: [99, 100, 101, 102, 103], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 20,
    baremoKey: 'retroalimentacion_desempeño'
  },
  'relacion_colaboradores': { 
    questions: [115, 116, 117, 118, 119, 120, 121, 122, 123], // CONDICIONAL
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 36,
    baremoKey: 'relacion_colaboradores',
    conditional: true
  },
  
  // DOMINIO: RECOMPENSAS
  'reconocimiento_compensacion': { 
    questions: [104, 105, 106, 107, 108, 109], 
    domain: 'recompensas', 
    maxScore: 24,
    baremoKey: 'reconocimiento_compensacion'
  },
  'recompensas_pertenencia': { 
    questions: [110, 111, 112, 113, 114], 
    domain: 'recompensas', 
    maxScore: 20,
    baremoKey: 'recompensas_pertenencia'
  }
};

// MAPEO COMPLETO DE DIMENSIONES FORMA B - OFICIAL BRS (97 preguntas)
const FORMA_B_DIMENSIONS = {
  // DOMINIO: DEMANDAS DEL TRABAJO  
  'demandas_ambientales': { 
    questions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 
    domain: 'demandas_trabajo', 
    maxScore: 48,
    baremoKey: 'demandas_ambientales'
  },
  'demandas_cuantitativas': { 
    questions: [13, 14, 15], 
    domain: 'demandas_trabajo', 
    maxScore: 12,
    baremoKey: 'demandas_cuantitativas'
  },
  'demandas_carga_mental': { 
    questions: [16, 17, 18, 19, 20], 
    domain: 'demandas_trabajo', 
    maxScore: 20,
    baremoKey: 'demandas_carga_mental'
  },
  'demandas_emocionales': { 
    questions: [21, 22, 23, 24, 25, 26, 27, 28], 
    domain: 'demandas_trabajo', 
    maxScore: 32,
    baremoKey: 'demandas_emocionales'
  },
  'demandas_jornada': { 
    questions: [29, 30, 31, 32], 
    domain: 'demandas_trabajo', 
    maxScore: 16,
    baremoKey: 'demandas_jornada'
  },
  'influencia_trabajo_entorno': { 
    questions: [33, 34, 35, 36], 
    domain: 'demandas_trabajo', 
    maxScore: 16,
    baremoKey: 'influencia_trabajo_entorno'
  },
  
  // DOMINIO: CONTROL SOBRE EL TRABAJO
  'control_autonomia': { 
    questions: [37, 38, 39, 40], 
    domain: 'control_trabajo', 
    maxScore: 16,
    baremoKey: 'control_autonomia'
  },
  'oportunidades_desarrollo': { 
    questions: [41, 42, 43, 44], 
    domain: 'control_trabajo', 
    maxScore: 16,
    baremoKey: 'oportunidades_desarrollo'
  },
  'participacion_manejo_cambio': { 
    questions: [45, 46, 47], 
    domain: 'control_trabajo', 
    maxScore: 12,
    baremoKey: 'participacion_manejo_cambio'
  },
  'claridad_rol': { 
    questions: [48, 49, 50, 51, 52], 
    domain: 'control_trabajo', 
    maxScore: 20,
    baremoKey: 'claridad_rol'
  },
  'capacitacion': { 
    questions: [53, 54, 55], 
    domain: 'control_trabajo', 
    maxScore: 12,
    baremoKey: 'capacitacion'
  },
  
  // DOMINIO: LIDERAZGO Y RELACIONES SOCIALES EN EL TRABAJO
  'caracteristicas_liderazgo': { 
    questions: [56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 52,
    baremoKey: 'caracteristicas_liderazgo'
  },
  'relaciones_sociales_trabajo': { 
    questions: [69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 44,
    baremoKey: 'relaciones_sociales_trabajo'
  },
  'retroalimentacion_desempeño': { 
    questions: [80, 81, 82, 83, 84], 
    domain: 'liderazgo_relaciones_sociales', 
    maxScore: 20,
    baremoKey: 'retroalimentacion_desempeño'
  },
  
  // DOMINIO: RECOMPENSAS
  'reconocimiento_compensacion': { 
    questions: [85, 86, 87, 88, 89, 90], 
    domain: 'recompensas', 
    maxScore: 24,
    baremoKey: 'reconocimiento_compensacion'
  },
  'recompensas_pertenencia': { 
    questions: [91, 92, 93, 94, 95, 96, 97], 
    domain: 'recompensas', 
    maxScore: 28,
    baremoKey: 'recompensas_pertenencia'
  }
};

// MAPEO DE DIMENSIONES EXTRALABORALES - 7 DIMENSIONES OFICIALES
const EXTRALABORAL_DIMENSIONS = {
  'tiempo_fuera_trabajo': { 
    questions: [1, 2, 3, 4], 
    domain: 'extralaboral', 
    maxScore: 16 
  },
  'relaciones_familiares': { 
    questions: [5, 6, 7, 8, 9, 10], 
    domain: 'extralaboral', 
    maxScore: 24 
  },
  'comunicacion_relaciones_interpersonales': { 
    questions: [11, 12, 13, 14, 15, 16, 17, 18], 
    domain: 'extralaboral', 
    maxScore: 32 
  },
  'situacion_economica': { 
    questions: [19, 20, 21], 
    domain: 'extralaboral', 
    maxScore: 12 
  },
  'caracteristicas_vivienda': { 
    questions: [22, 23, 24, 25], 
    domain: 'extralaboral', 
    maxScore: 16 
  },
  'influencia_entorno_trabajo': { 
    questions: [26, 27, 28, 29], 
    domain: 'extralaboral', 
    maxScore: 16 
  },
  'desplazamiento_vivienda_trabajo': { 
    questions: [30, 31], 
    domain: 'extralaboral', 
    maxScore: 8 
  }
};

// MAPEO DE SÍNTOMAS DE ESTRÉS - 4 CATEGORÍAS OFICIALES
const STRESS_DIMENSIONS = {
  'sintomas_fisiologicos': { 
    questions: [1, 2, 3, 4, 5, 6, 7, 8], 
    domain: 'estres', 
    maxScore: 24 
  },
  'sintomas_comportamiento_social': { 
    questions: [9, 10, 11, 12, 13, 14], 
    domain: 'estres', 
    maxScore: 18 
  },
  'sintomas_intelectuales_laborales': { 
    questions: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24], 
    domain: 'estres', 
    maxScore: 30 
  },
  'sintomas_psicoemocionales': { 
    questions: [25, 26, 27, 28, 29, 30, 31], 
    domain: 'estres', 
    maxScore: 21 
  }
};

// Get baremos from official BRS data structure
function getBaremosForCalculation(forma, tipo, dimension) {
  try {
    return getBaremos(forma, tipo, dimension);
  } catch (error) {
    console.warn(`Baremo no encontrado: ${forma}, ${tipo}, ${dimension}. Usando valores por defecto.`);
    // Fallback baremos
    return {
      sin_riesgo: [0, 20],
      riesgo_bajo: [20.1, 40],
      riesgo_medio: [40.1, 60],
      riesgo_alto: [60.1, 80],
      riesgo_muy_alto: [80.1, 100]
    };
  }
}

// Calculate results for intralaboral questionnaire (Form A or B)
async function calculateIntralaboralResults(questionnaireType, responses) {
  const forma = questionnaireType === 'intralaboral_a' ? 'A' : 'B';
  const dimensions = forma === 'A' ? FORMA_A_DIMENSIONS : FORMA_B_DIMENSIONS;
  const results = [];
  
  // Group responses by question number for easy lookup
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });
  
  // Calculate score for each dimension
  for (const [dimensionName, dimensionData] of Object.entries(dimensions)) {
    let rawScore = 0;
    let answeredQuestions = 0;
    
    // Sum up responses for this dimension
    dimensionData.questions.forEach(questionNumber => {
      if (responseMap[questionNumber] !== undefined) {
        rawScore += responseMap[questionNumber];
        answeredQuestions++;
      }
    });
    
    // Skip if no questions answered for this dimension
    if (answeredQuestions === 0) continue;
    
    // Calculate transformed score (0-100) using OFFICIAL BRS FORMULA
    const transformedScore = transformScore(rawScore, dimensionData.maxScore);
    
    // Calculate percentile using BRS methodology
    const percentile = calculatePercentile(transformedScore, dimensionName, forma);
    
    // Get risk level using OFFICIAL BRS BAREMOS
    const dimensionBaremos = getBaremosForCalculation(forma, 'dimension', dimensionData.baremoKey);
    const riskLevel = getRiskLevel(transformedScore, dimensionBaremos);
    
    results.push({
      questionnaireType,
      dimension: dimensionName,
      domain: dimensionData.domain,
      rawScore,
      transformedScore,
      percentile,
      riskLevel,
      answeredQuestions,
      totalQuestions: dimensionData.questions.length
    });
  }
  
  // Calculate DOMAIN scores (OFICIAL BRS)
  const domainScores = {};
  const domainQuestionCounts = {};
  const domainMaxScores = {};
  
  results.forEach(result => {
    if (!domainScores[result.domain]) {
      domainScores[result.domain] = 0;
      domainQuestionCounts[result.domain] = 0;
      domainMaxScores[result.domain] = 0;
    }
    
    const dimensionData = dimensions[result.dimension];
    domainScores[result.domain] += result.rawScore;
    domainQuestionCounts[result.domain] += result.answeredQuestions;
    domainMaxScores[result.domain] += dimensionData.maxScore;
  });
  
  // Add domain results
  for (const [domainName, domainRawScore] of Object.entries(domainScores)) {
    const domainTransformedScore = transformScore(domainRawScore, domainMaxScores[domainName]);
    const domainPercentile = calculatePercentile(domainTransformedScore, domainName, forma);
    
    // Map domain names for baremo lookup
    const domainBaremoKey = domainName === 'demandas_trabajo' ? 'demandas_trabajo' :
                           domainName === 'control_trabajo' ? 'control_trabajo' :
                           domainName === 'liderazgo_relaciones_sociales' ? 'liderazgo_relaciones_sociales' :
                           domainName === 'recompensas' ? 'recompensas' : domainName;
    
    const domainBaremos = getBaremosForCalculation(forma, 'dominio', domainBaremoKey);
    const domainRiskLevel = getRiskLevel(domainTransformedScore, domainBaremos);
    
    results.push({
      questionnaireType,
      dimension: `${domainName}_total`,
      domain: domainName,
      rawScore: domainRawScore,
      transformedScore: domainTransformedScore,
      percentile: domainPercentile,
      riskLevel: domainRiskLevel,
      answeredQuestions: domainQuestionCounts[domainName],
      totalQuestions: domainQuestionCounts[domainName],
      isDomainTotal: true
    });
  }
  
  return results;
}

// Calculate results for extralaboral questionnaire - 7 DIMENSIONES OFICIALES
async function calculateExtralaboralResults(questionnaireType, responses) {
  const results = [];
  const dimensions = EXTRALABORAL_DIMENSIONS;
  
  // Group responses by question number
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });
  
  // Calculate score for each dimension
  for (const [dimensionName, dimensionData] of Object.entries(dimensions)) {
    let rawScore = 0;
    let answeredQuestions = 0;
    
    dimensionData.questions.forEach(questionNumber => {
      if (responseMap[questionNumber] !== undefined) {
        rawScore += responseMap[questionNumber];
        answeredQuestions++;
      }
    });
    
    if (answeredQuestions === 0) continue;
    
    const transformedScore = transformScore(rawScore, dimensionData.maxScore);
    const percentile = calculatePercentile(transformedScore, dimensionName, 'extralaboral');
    
    // Use estimated baremos for extralaboral (official ones not found in document)
    const dimensionBaremos = BAREMOS_BRS.extralaboral.dimensiones[dimensionName] || {
      sin_riesgo: [0, 25], riesgo_bajo: [25.1, 37.5], riesgo_medio: [37.6, 50],
      riesgo_alto: [50.1, 62.5], riesgo_muy_alto: [62.6, 100]
    };
    
    const riskLevel = getRiskLevel(transformedScore, dimensionBaremos);
    
    results.push({
      questionnaireType,
      dimension: dimensionName,
      domain: 'extralaboral',
      rawScore,
      transformedScore,
      percentile,
      riskLevel,
      answeredQuestions,
      totalQuestions: dimensionData.questions.length
    });
  }
  
  return results;
}

// Calculate results for stress questionnaire - 4 CATEGORÍAS DE SÍNTOMAS OFICIALES
async function calculateStressResults(questionnaireType, responses) {
  const results = [];
  const dimensions = STRESS_DIMENSIONS;
  
  // Group responses by question number
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });
  
  // Calculate score for each stress symptom category
  for (const [dimensionName, dimensionData] of Object.entries(dimensions)) {
    let rawScore = 0;
    let answeredQuestions = 0;
    
    dimensionData.questions.forEach(questionNumber => {
      if (responseMap[questionNumber] !== undefined) {
        rawScore += responseMap[questionNumber];
        answeredQuestions++;
      }
    });
    
    if (answeredQuestions === 0) continue;
    
    const transformedScore = transformScore(rawScore, dimensionData.maxScore);
    const percentile = calculatePercentile(transformedScore, dimensionName, 'stress');
    
    // Use estimated baremos for stress symptoms
    const dimensionBaremos = BAREMOS_BRS.estres[dimensionName] || {
      sin_riesgo: [0, 25], riesgo_bajo: [25.1, 37.5], riesgo_medio: [37.6, 50],
      riesgo_alto: [50.1, 62.5], riesgo_muy_alto: [62.6, 100]
    };
    
    const riskLevel = getRiskLevel(transformedScore, dimensionBaremos);
    
    results.push({
      questionnaireType,
      dimension: dimensionName,
      domain: 'estres',
      rawScore,
      transformedScore,
      percentile,
      riskLevel,
      answeredQuestions,
      totalQuestions: dimensionData.questions.length
    });
  }
  
  return results;
}

// Main calculation function
async function calculateResults(questionnaireType, responses) {
  if (!responses || responses.length === 0) {
    throw new Error('No hay respuestas para calcular');
  }
  
  switch (questionnaireType) {
    case 'intralaboral_a':
    case 'intralaboral_b':
      return await calculateIntralaboralResults(questionnaireType, responses);
    
    case 'extralaboral':
      return await calculateExtralaboralResults(questionnaireType, responses);
    
    case 'stress':
      return await calculateStressResults(questionnaireType, responses);
    
    default:
      throw new Error(`Tipo de cuestionario no soportado: ${questionnaireType}`);
  }
}

module.exports = calculateResults;