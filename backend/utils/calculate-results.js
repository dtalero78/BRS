const { BAREMOS_BRS, getRiskLevel, getBaremos } = require('./baremos-completos');

// ========================================================================
// ITEMS INVERTIDOS - TABLAS 21, 22, 11 DEL DOCUMENTO OFICIAL
// ========================================================================
// Items where scoring is inverted (protective/positive factors):
// Stored: Siempre=4, Casi siempre=3, A veces=2, Casi nunca=1, Nunca=0
// For inverted items: score = 4 - responseValue (Siempre->0, Nunca->4)
// For non-inverted items: score = responseValue (Siempre->4, Nunca->0)

// Forma A - Items scored 0,1,2,3,4 (Tabla 21) - NECESITAN INVERSION
const FORMA_A_INVERTED_ITEMS = new Set([
  4, 5, 6, 9, 12, 14, 32, 34,
  39, 40, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 50, 51,
  53, 54, 55, 56, 57, 58, 59,
  60, 61, 62,
  63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  90, 91, 92, 93, 94,
  95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105
]);

// Forma B - Items scored 0,1,2,3,4 (Tabla 22) - NECESITAN INVERSION
const FORMA_B_INVERTED_ITEMS = new Set([
  4, 5, 6, 9, 12, 14, 22, 24,
  29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40,
  41, 42, 43, 44, 45,
  46, 47, 48,
  49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
  62, 63, 64, 65, 67, 68, 69, 70, 71, 72, 73,
  74, 75, 76, 77, 78,
  79, 80, 81, 82, 83, 84,
  85, 86, 87, 88,
  97
]);

// Extralaboral - Items scored 0,1,2,3,4 (Tabla 11) - NECESITAN INVERSION
const EXTRALABORAL_INVERTED_ITEMS = new Set([
  1, 4, 5, 7, 8, 9, 10, 11, 12, 13,
  14, 15, 16, 17,
  18, 19, 20, 21, 22, 23,
  25, 27, 29
]);

// ========================================================================
// MAPEO OFICIAL DE DIMENSIONES - TABLA 23 (INTRALABORAL), TABLA 12 (EXTRALABORAL)
// Con factores de transformacion de Tablas 25, 26, 14
// ========================================================================

// FORMA A INTRALABORAL - 19 dimensiones (Tabla 23 + Tabla 25)
const FORMA_A_DIMENSIONS = {
  // DOMINIO: DEMANDAS DEL TRABAJO
  'demandas_ambientales': {
    questions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    domain: 'demandas_trabajo',
    maxScore: 48,
    baremoKey: 'demandas_ambientales'
  },
  'demandas_cuantitativas': {
    questions: [13, 14, 15, 32, 43, 47],
    domain: 'demandas_trabajo',
    maxScore: 24,
    baremoKey: 'demandas_cuantitativas'
  },
  'demandas_carga_mental': {
    questions: [16, 17, 18, 20, 21],
    domain: 'demandas_trabajo',
    maxScore: 20,
    baremoKey: 'demandas_carga_mental'
  },
  'demandas_emocionales': {
    questions: [106, 107, 108, 109, 110, 111, 112, 113, 114],
    domain: 'demandas_trabajo',
    maxScore: 36,
    baremoKey: 'demandas_emocionales'
  },
  'exigencias_responsabilidad': {
    questions: [19, 22, 23, 24, 25, 26],
    domain: 'demandas_trabajo',
    maxScore: 24,
    baremoKey: 'exigencias_responsabilidad'
  },
  'demandas_jornada': {
    questions: [31, 33, 34],
    domain: 'demandas_trabajo',
    maxScore: 12,
    baremoKey: 'demandas_jornada'
  },
  'consistencia_rol': {
    questions: [27, 28, 29, 30, 52],
    domain: 'demandas_trabajo',
    maxScore: 20,
    baremoKey: 'consistencia_rol'
  },
  'influencia_trabajo_entorno': {
    questions: [35, 36, 37, 38],
    domain: 'demandas_trabajo',
    maxScore: 16,
    baremoKey: 'influencia_trabajo_entorno'
  },

  // DOMINIO: CONTROL SOBRE EL TRABAJO
  'control_autonomia': {
    questions: [44, 45, 46],
    domain: 'control_trabajo',
    maxScore: 12,
    baremoKey: 'control_autonomia'
  },
  'oportunidades_desarrollo': {
    questions: [39, 40, 41, 42],
    domain: 'control_trabajo',
    maxScore: 16,
    baremoKey: 'oportunidades_desarrollo'
  },
  'participacion_manejo_cambio': {
    questions: [48, 49, 50, 51],
    domain: 'control_trabajo',
    maxScore: 16,
    baremoKey: 'participacion_manejo_cambio'
  },
  'claridad_rol': {
    questions: [53, 54, 55, 56, 57, 58, 59],
    domain: 'control_trabajo',
    maxScore: 28,
    baremoKey: 'claridad_rol'
  },
  'capacitacion': {
    questions: [60, 61, 62],
    domain: 'control_trabajo',
    maxScore: 12,
    baremoKey: 'capacitacion'
  },

  // DOMINIO: LIDERAZGO Y RELACIONES SOCIALES EN EL TRABAJO
  'caracteristicas_liderazgo': {
    questions: [63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 52,
    baremoKey: 'caracteristicas_liderazgo'
  },
  'relaciones_sociales_trabajo': {
    questions: [76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 56,
    baremoKey: 'relaciones_sociales_trabajo'
  },
  'retroalimentacion_desempeño': {
    questions: [90, 91, 92, 93, 94],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 20,
    baremoKey: 'retroalimentacion_desempeño'
  },
  'relacion_colaboradores': {
    questions: [115, 116, 117, 118, 119, 120, 121, 122, 123],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 36,
    baremoKey: 'relacion_colaboradores',
    conditional: true
  },

  // DOMINIO: RECOMPENSAS
  'reconocimiento_compensacion': {
    questions: [96, 97, 98, 99, 100, 101],
    domain: 'recompensas',
    maxScore: 24,
    baremoKey: 'reconocimiento_compensacion'
  },
  'recompensas_pertenencia': {
    questions: [95, 102, 103, 104, 105],
    domain: 'recompensas',
    maxScore: 20,
    baremoKey: 'recompensas_pertenencia'
  }
};

// FORMA B INTRALABORAL - 16 dimensiones (Tabla 23 + Tabla 26)
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
    questions: [89, 90, 91, 92, 93, 94, 95, 96, 97],
    domain: 'demandas_trabajo',
    maxScore: 36,
    baremoKey: 'demandas_emocionales'
  },
  'demandas_jornada': {
    questions: [21, 22, 23, 24, 33, 37],
    domain: 'demandas_trabajo',
    maxScore: 24,
    baremoKey: 'demandas_jornada'
  },
  'influencia_trabajo_entorno': {
    questions: [25, 26, 27, 28],
    domain: 'demandas_trabajo',
    maxScore: 16,
    baremoKey: 'influencia_trabajo_entorno'
  },

  // DOMINIO: CONTROL SOBRE EL TRABAJO
  'control_autonomia': {
    questions: [34, 35, 36],
    domain: 'control_trabajo',
    maxScore: 12,
    baremoKey: 'control_autonomia'
  },
  'oportunidades_desarrollo': {
    questions: [29, 30, 31, 32],
    domain: 'control_trabajo',
    maxScore: 16,
    baremoKey: 'oportunidades_desarrollo'
  },
  'participacion_manejo_cambio': {
    questions: [38, 39, 40],
    domain: 'control_trabajo',
    maxScore: 12,
    baremoKey: 'participacion_manejo_cambio'
  },
  'claridad_rol': {
    questions: [41, 42, 43, 44, 45],
    domain: 'control_trabajo',
    maxScore: 20,
    baremoKey: 'claridad_rol'
  },
  'capacitacion': {
    questions: [46, 47, 48],
    domain: 'control_trabajo',
    maxScore: 12,
    baremoKey: 'capacitacion'
  },

  // DOMINIO: LIDERAZGO Y RELACIONES SOCIALES EN EL TRABAJO
  'caracteristicas_liderazgo': {
    questions: [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 52,
    baremoKey: 'caracteristicas_liderazgo'
  },
  'relaciones_sociales_trabajo': {
    questions: [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 48,
    baremoKey: 'relaciones_sociales_trabajo'
  },
  'retroalimentacion_desempeño': {
    questions: [74, 75, 76, 77, 78],
    domain: 'liderazgo_relaciones_sociales',
    maxScore: 20,
    baremoKey: 'retroalimentacion_desempeño'
  },

  // DOMINIO: RECOMPENSAS
  'reconocimiento_compensacion': {
    questions: [79, 80, 81, 82, 83, 84],
    domain: 'recompensas',
    maxScore: 24,
    baremoKey: 'reconocimiento_compensacion'
  },
  'recompensas_pertenencia': {
    questions: [85, 86, 87, 88],
    domain: 'recompensas',
    maxScore: 16,
    baremoKey: 'recompensas_pertenencia'
  }
};

// EXTRALABORAL - 7 dimensiones (Tabla 12 + Tabla 14)
const EXTRALABORAL_DIMENSIONS = {
  'tiempo_fuera_trabajo': {
    questions: [14, 15, 16, 17],
    domain: 'extralaboral',
    maxScore: 16
  },
  'relaciones_familiares': {
    questions: [22, 25, 27],
    domain: 'extralaboral',
    maxScore: 12
  },
  'comunicacion_relaciones_interpersonales': {
    questions: [18, 19, 20, 21, 23],
    domain: 'extralaboral',
    maxScore: 20
  },
  'situacion_economica': {
    questions: [29, 30, 31],
    domain: 'extralaboral',
    maxScore: 12
  },
  'caracteristicas_vivienda': {
    questions: [5, 6, 7, 8, 9, 10, 11, 12, 13],
    domain: 'extralaboral',
    maxScore: 36
  },
  'influencia_entorno_trabajo': {
    questions: [24, 26, 28],
    domain: 'extralaboral',
    maxScore: 12
  },
  'desplazamiento_vivienda_trabajo': {
    questions: [1, 2, 3, 4],
    domain: 'extralaboral',
    maxScore: 16
  }
};

// Factor de transformacion total extralaboral (Tabla 14)
const EXTRALABORAL_TOTAL_MAX_SCORE = 124;

// ========================================================================
// ESTRES - CATEGORIAS Y PUNTUACION VARIABLE (Tablas 4 y 6)
// ========================================================================

// Puntuacion variable por item de estres (Tabla 4)
// Stored: Siempre=3, Casi siempre=2, A veces=1, Nunca=0
const STRESS_SCORING = {
  // Grupo 1: Siempre=9, Casi siempre=6, A veces=3, Nunca=0
  group1: {
    items: new Set([1, 2, 3, 9, 13, 14, 15, 23, 24]),
    map: { 3: 9, 2: 6, 1: 3, 0: 0 }
  },
  // Grupo 2: Siempre=6, Casi siempre=4, A veces=2, Nunca=0
  group2: {
    items: new Set([4, 5, 6, 10, 11, 16, 17, 18, 19, 25, 26, 27, 28]),
    map: { 3: 6, 2: 4, 1: 2, 0: 0 }
  },
  // Grupo 3: Siempre=3, Casi siempre=2, A veces=1, Nunca=0
  group3: {
    items: new Set([7, 8, 12, 20, 21, 22, 29, 30, 31]),
    map: { 3: 3, 2: 2, 1: 1, 0: 0 }
  }
};

// Grupos de ponderacion para calculo del puntaje bruto total de estres
const STRESS_WEIGHT_GROUPS = [
  { items: [1, 2, 3, 4, 5, 6, 7, 8], weight: 4 },
  { items: [9, 10, 11, 12], weight: 3 },
  { items: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22], weight: 2 },
  { items: [23, 24, 25, 26, 27, 28, 29, 30, 31], weight: 1 }
];

// Factor de transformacion de estres
const STRESS_TRANSFORM_FACTOR = 61.16;

// ========================================================================
// FUNCIONES DE PUNTUACION
// ========================================================================

// Transformar puntaje bruto a porcentaje (escala 0-100) - FORMULA OFICIAL BRS
function transformScore(rawScore, maxScore) {
  if (maxScore === 0) return 0;
  return Math.round((rawScore / maxScore) * 100 * 100) / 100;
}

// Obtener puntaje de item intralaboral/extralaboral con manejo de inversion
function getItemScore(questionNumber, responseValue, invertedItems) {
  if (invertedItems.has(questionNumber)) {
    return 4 - responseValue;
  }
  return responseValue;
}

// Obtener puntaje de item de estres (puntuacion variable por Tabla 4)
function getStressItemScore(questionNumber, responseValue) {
  for (const group of Object.values(STRESS_SCORING)) {
    if (group.items.has(questionNumber)) {
      return group.map[responseValue] !== undefined ? group.map[responseValue] : 0;
    }
  }
  return 0;
}

// Obtener baremos con fallback
function getBaremosForCalculation(forma, tipo, dimension) {
  try {
    return getBaremos(forma, tipo, dimension);
  } catch (error) {
    console.warn(`Baremo no encontrado: ${forma}, ${tipo}, ${dimension}. Usando valores por defecto.`);
    return {
      sin_riesgo: [0, 20],
      riesgo_bajo: [20.1, 40],
      riesgo_medio: [40.1, 60],
      riesgo_alto: [60.1, 80],
      riesgo_muy_alto: [80.1, 100]
    };
  }
}

// ========================================================================
// CALCULO INTRALABORAL (Forma A o B)
// ========================================================================

async function calculateIntralaboralResults(questionnaireType, responses) {
  const forma = questionnaireType === 'intralaboral_a' ? 'A' : 'B';
  const dimensions = forma === 'A' ? FORMA_A_DIMENSIONS : FORMA_B_DIMENSIONS;
  const invertedItems = forma === 'A' ? FORMA_A_INVERTED_ITEMS : FORMA_B_INVERTED_ITEMS;
  const results = [];

  // Agrupar respuestas por numero de pregunta
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });

  // Calcular puntaje por dimension
  for (const [dimensionName, dimensionData] of Object.entries(dimensions)) {
    let rawScore = 0;
    let answeredQuestions = 0;

    dimensionData.questions.forEach(questionNumber => {
      if (responseMap[questionNumber] !== undefined) {
        rawScore += getItemScore(questionNumber, responseMap[questionNumber], invertedItems);
        answeredQuestions++;
      }
    });

    if (answeredQuestions === 0) continue;

    const transformedScore = transformScore(rawScore, dimensionData.maxScore);

    // Nivel de riesgo con baremos oficiales
    const dimensionBaremos = getBaremosForCalculation(forma, 'dimension', dimensionData.baremoKey);
    const riskLevel = getRiskLevel(transformedScore, dimensionBaremos);

    results.push({
      questionnaireType,
      dimension: dimensionName,
      domain: dimensionData.domain,
      rawScore,
      transformedScore,
      percentile: transformedScore,
      riskLevel,
      answeredQuestions,
      totalQuestions: dimensionData.questions.length
    });
  }

  // Calcular puntajes por DOMINIO
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

  let totalRawScore = 0;
  let totalMaxScore = 0;

  for (const [domainName, domainRawScore] of Object.entries(domainScores)) {
    const domainTransformedScore = transformScore(domainRawScore, domainMaxScores[domainName]);

    const domainBaremos = getBaremosForCalculation(forma, 'dominio', domainName);
    const domainRiskLevel = getRiskLevel(domainTransformedScore, domainBaremos);

    totalRawScore += domainRawScore;
    totalMaxScore += domainMaxScores[domainName];

    results.push({
      questionnaireType,
      dimension: `${domainName}_total`,
      domain: domainName,
      rawScore: domainRawScore,
      transformedScore: domainTransformedScore,
      percentile: domainTransformedScore,
      riskLevel: domainRiskLevel,
      answeredQuestions: domainQuestionCounts[domainName],
      totalQuestions: domainQuestionCounts[domainName],
      isDomainTotal: true
    });
  }

  // Puntaje TOTAL INTRALABORAL (Tabla 33)
  if (totalMaxScore > 0) {
    const totalTransformedScore = transformScore(totalRawScore, totalMaxScore);
    const totalBaremos = getBaremosForCalculation(forma, 'total', null);
    const totalRiskLevel = getRiskLevel(totalTransformedScore, totalBaremos);

    results.push({
      questionnaireType,
      dimension: 'puntaje_total_intralaboral',
      domain: 'intralaboral',
      rawScore: totalRawScore,
      transformedScore: totalTransformedScore,
      percentile: totalTransformedScore,
      riskLevel: totalRiskLevel,
      answeredQuestions: Object.values(domainQuestionCounts).reduce((a, b) => a + b, 0),
      totalQuestions: Object.values(domainQuestionCounts).reduce((a, b) => a + b, 0),
      isTotal: true
    });
  }

  return results;
}

// ========================================================================
// CALCULO EXTRALABORAL
// ========================================================================

async function calculateExtralaboralResults(questionnaireType, responses, options = {}) {
  const results = [];
  const dimensions = EXTRALABORAL_DIMENSIONS;
  const occupationalGroup = options.occupationalGroup || 'jefes';

  // Agrupar respuestas por numero de pregunta
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });

  let totalRawScore = 0;

  for (const [dimensionName, dimensionData] of Object.entries(dimensions)) {
    let rawScore = 0;
    let answeredQuestions = 0;

    dimensionData.questions.forEach(questionNumber => {
      if (responseMap[questionNumber] !== undefined) {
        rawScore += getItemScore(questionNumber, responseMap[questionNumber], EXTRALABORAL_INVERTED_ITEMS);
        answeredQuestions++;
      }
    });

    if (answeredQuestions === 0) continue;

    totalRawScore += rawScore;

    const transformedScore = transformScore(rawScore, dimensionData.maxScore);

    // Baremos duales segun grupo ocupacional (Tabla 17 jefes / Tabla 18 auxiliares)
    const baremoSet = occupationalGroup === 'auxiliares'
      ? BAREMOS_BRS.extralaboral_auxiliares
      : BAREMOS_BRS.extralaboral_jefes;

    const dimensionBaremos = (baremoSet && baremoSet.dimensiones && baremoSet.dimensiones[dimensionName]) || {
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
      percentile: transformedScore,
      riskLevel,
      answeredQuestions,
      totalQuestions: dimensionData.questions.length
    });
  }

  // Puntaje TOTAL EXTRALABORAL
  if (results.length > 0) {
    const totalTransformedScore = transformScore(totalRawScore, EXTRALABORAL_TOTAL_MAX_SCORE);

    const baremoSet = occupationalGroup === 'auxiliares'
      ? BAREMOS_BRS.extralaboral_auxiliares
      : BAREMOS_BRS.extralaboral_jefes;

    const totalBaremos = (baremoSet && baremoSet.total) || {
      sin_riesgo: [0, 11.3], riesgo_bajo: [11.4, 16.9], riesgo_medio: [17, 22.6],
      riesgo_alto: [22.7, 29], riesgo_muy_alto: [29.1, 100]
    };

    const totalRiskLevel = getRiskLevel(totalTransformedScore, totalBaremos);

    results.push({
      questionnaireType,
      dimension: 'puntaje_total_extralaboral',
      domain: 'extralaboral',
      rawScore: totalRawScore,
      transformedScore: totalTransformedScore,
      percentile: totalTransformedScore,
      riskLevel: totalRiskLevel,
      answeredQuestions: results.reduce((sum, r) => sum + r.answeredQuestions, 0),
      totalQuestions: 31,
      isTotal: true
    });
  }

  return results;
}

// ========================================================================
// CALCULO ESTRES - METODOLOGIA OFICIAL CON PONDERACION
// ========================================================================

async function calculateStressResults(questionnaireType, responses, options = {}) {
  const results = [];
  const occupationalGroup = options.occupationalGroup || 'jefes';

  // Agrupar respuestas por numero de pregunta
  const responseMap = {};
  responses.forEach(response => {
    responseMap[response.question_number] = response.response_value;
  });

  // Calculo del puntaje bruto total ponderado (metodologia oficial):
  // a) Promedio items 1-8 x 4
  // b) Promedio items 9-12 x 3
  // c) Promedio items 13-22 x 2
  // d) Promedio items 23-31 x 1
  // Puntaje bruto total = a + b + c + d

  let puntajeBrutoTotal = 0;

  for (const group of STRESS_WEIGHT_GROUPS) {
    let groupScoreSum = 0;
    let groupCount = 0;

    group.items.forEach(itemNum => {
      if (responseMap[itemNum] !== undefined) {
        const scoredValue = getStressItemScore(itemNum, responseMap[itemNum]);
        groupScoreSum += scoredValue;
        groupCount++;
      }
    });

    if (groupCount > 0) {
      const groupAverage = groupScoreSum / groupCount;
      puntajeBrutoTotal += groupAverage * group.weight;
    }
  }

  // Puntaje TOTAL de estres (transformado y con baremos)
  // Nota: La metodologia oficial solo define baremos para el puntaje total,
  // no para categorias individuales de sintomas
  const totalTransformedScore = Math.round((puntajeBrutoTotal / STRESS_TRANSFORM_FACTOR) * 100 * 100) / 100;

  // Baremos oficiales por grupo ocupacional (Tabla 6)
  const stressBaremos = occupationalGroup === 'auxiliares'
    ? BAREMOS_BRS.estres_auxiliares
    : BAREMOS_BRS.estres_jefes;

  const totalRiskLevel = getRiskLevel(totalTransformedScore, stressBaremos || {
    sin_riesgo: [0, 7.8], riesgo_bajo: [7.9, 12.6], riesgo_medio: [12.7, 17.7],
    riesgo_alto: [17.8, 25], riesgo_muy_alto: [25.1, 100]
  });

  results.push({
    questionnaireType: 'estres',
    dimension: 'puntaje_total_estres',
    domain: 'estres',
    rawScore: Math.round(puntajeBrutoTotal * 100) / 100,
    transformedScore: totalTransformedScore,
    percentile: totalTransformedScore,
    riskLevel: totalRiskLevel,
    answeredQuestions: Object.keys(responseMap).length,
    totalQuestions: 31,
    isTotal: true
  });

  return results;
}

// ========================================================================
// FUNCION PRINCIPAL DE CALCULO
// ========================================================================

async function calculateResults(questionnaireType, responses, options = {}) {
  if (!responses || responses.length === 0) {
    throw new Error('No hay respuestas para calcular');
  }

  switch (questionnaireType) {
    case 'intralaboral_a':
    case 'intralaboral_b':
      return await calculateIntralaboralResults(questionnaireType, responses);

    case 'extralaboral':
      return await calculateExtralaboralResults(questionnaireType, responses, options);

    case 'stress':
    case 'estres':
      return await calculateStressResults('estres', responses, options);

    default:
      throw new Error(`Tipo de cuestionario no soportado: ${questionnaireType}`);
  }
}

module.exports = calculateResults;
