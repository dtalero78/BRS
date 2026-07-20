const { BAREMOS_BRS, getRiskLevel } = require('../utils/baremos-completos');

const RISK_LEVELS = ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto'];

// Un "baremo hoja" es un objeto con los 5 niveles, cada uno [min, max].
function isBaremo(obj) {
  return obj && typeof obj === 'object' && RISK_LEVELS.every(l => Array.isArray(obj[l]) && obj[l].length === 2);
}

// Recorre BAREMOS_BRS y devuelve [{ path, baremo }] por cada baremo hoja.
function collectBaremos(node, path = '') {
  if (isBaremo(node)) return [{ path, baremo: node }];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => collectBaremos(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const allBaremos = collectBaremos(BAREMOS_BRS);

describe('Integridad de las tablas de baremos', () => {
  test('se detectaron baremos hoja para recorrer', () => {
    expect(allBaremos.length).toBeGreaterThan(30);
  });

  // C1: el manual exige manejar los puntajes transformados con UN decimal. A esa
  // resolución, cada valor de 0.0 a 100.0 debe caer en exactamente un nivel de riesgo.
  // Si algún valor cae en un hueco, getRiskLevel devuelve el fallback 'riesgo_medio'
  // y clasifica mal. Este test recorre TODOS los baremos y prueba los 1001 valores.
  test('ningún puntaje de 1 decimal en [0,100] cae en un hueco (fallback riesgo_medio)', () => {
    const offenders = [];
    for (const { path, baremo } of allBaremos) {
      for (let n = 0; n <= 1000; n++) {
        const score = Math.round(n) / 10; // 0.0, 0.1, ... 100.0
        // Reproduce la lógica de rango de getRiskLevel para saber si hay match real.
        const matched = RISK_LEVELS.some(l => score >= baremo[l][0] && score <= baremo[l][1]);
        if (!matched) offenders.push(`${path} @ ${score.toFixed(1)}`);
      }
    }
    expect(offenders.slice(0, 20)).toEqual([]);
    expect(offenders).toHaveLength(0);
  });

  test('los rangos son contiguos y ordenados dentro de cada baremo', () => {
    const problems = [];
    for (const { path, baremo } of allBaremos) {
      for (let i = 0; i < RISK_LEVELS.length; i++) {
        const [lo, hi] = baremo[RISK_LEVELS[i]];
        if (lo > hi) problems.push(`${path}.${RISK_LEVELS[i]}: min>max [${lo},${hi}]`);
        if (i > 0) {
          const prevHi = baremo[RISK_LEVELS[i - 1]][1];
          // El siguiente nivel debe empezar 0.1 por encima del anterior (a 1 decimal).
          const gap = Math.round((lo - prevHi) * 10) / 10;
          if (gap !== 0.1) problems.push(`${path}: salto ${gap} entre ${RISK_LEVELS[i - 1]}(${prevHi}) y ${RISK_LEVELS[i]}(${lo})`);
        }
      }
      expect(baremo.sin_riesgo[0]).toBe(0);
      expect(baremo.riesgo_muy_alto[1]).toBe(100);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });
});

describe('Fidelidad de baremos contra el Manual General (Tabla 29 - Forma A)', () => {
  // Valores transcritos del PDF oficial del Ministerio (pág. 84, Tabla 29).
  const MANUAL_FORMA_A = {
    caracteristicas_liderazgo:       [[0, 3.8], [3.9, 15.4], [15.5, 30.8], [30.9, 46.2], [46.3, 100]],
    relaciones_sociales_trabajo:     [[0, 5.4], [5.5, 16.1], [16.2, 25.0], [25.1, 37.5], [37.6, 100]],
    retroalimentacion_desempeño:     [[0, 10.0], [10.1, 25.0], [25.1, 40.0], [40.1, 55.0], [55.1, 100]],
    relacion_colaboradores:          [[0, 13.9], [14.0, 25.0], [25.1, 33.3], [33.4, 47.2], [47.3, 100]],
    claridad_rol:                    [[0, 0.9], [1.0, 10.7], [10.8, 21.4], [21.5, 39.3], [39.4, 100]],
    capacitacion:                    [[0, 0.9], [1.0, 16.7], [16.8, 33.3], [33.4, 50.0], [50.1, 100]],
    participacion_manejo_cambio:     [[0, 12.5], [12.6, 25.0], [25.1, 37.5], [37.6, 50.0], [50.1, 100]],
    oportunidades_desarrollo:        [[0, 0.9], [1.0, 6.3], [6.4, 18.8], [18.9, 31.3], [31.4, 100]],
    control_autonomia:               [[0, 8.3], [8.4, 25.0], [25.1, 41.7], [41.8, 58.3], [58.4, 100]],
    demandas_ambientales:            [[0, 14.6], [14.7, 22.9], [23.0, 31.3], [31.4, 39.6], [39.7, 100]],
    demandas_emocionales:            [[0, 16.7], [16.8, 25.0], [25.1, 33.3], [33.4, 47.2], [47.3, 100]],
    demandas_cuantitativas:          [[0, 25.0], [25.1, 33.3], [33.4, 45.8], [45.9, 54.2], [54.3, 100]],
    influencia_trabajo_entorno:      [[0, 18.8], [18.9, 31.3], [31.4, 43.8], [43.9, 50.0], [50.1, 100]],
    exigencias_responsabilidad:      [[0, 37.5], [37.6, 54.2], [54.3, 66.7], [66.8, 79.2], [79.3, 100]],
    demandas_carga_mental:           [[0, 60.0], [60.1, 70.0], [70.1, 80.0], [80.1, 90.0], [90.1, 100]],
    consistencia_rol:                [[0, 15.0], [15.1, 25.0], [25.1, 35.0], [35.1, 45.0], [45.1, 100]],
    demandas_jornada:                [[0, 8.3], [8.4, 25.0], [25.1, 33.3], [33.4, 50.0], [50.1, 100]],
    recompensas_pertenencia:         [[0, 0.9], [1.0, 5.0], [5.1, 10.0], [10.1, 20.0], [20.1, 100]],
    reconocimiento_compensacion:     [[0, 4.2], [4.3, 16.7], [16.8, 25.0], [25.1, 37.5], [37.6, 100]],
  };

  const codeA = BAREMOS_BRS.intralaboral_forma_a.dimensiones;

  test.each(Object.keys(MANUAL_FORMA_A))('%s coincide con la Tabla 29', (dim) => {
    const expected = MANUAL_FORMA_A[dim];
    const actual = codeA[dim];
    expect(actual).toBeDefined();
    RISK_LEVELS.forEach((lv, i) => {
      expect(actual[lv][0]).toBeCloseTo(expected[i][0], 5);
      expect(actual[lv][1]).toBeCloseTo(expected[i][1], 5);
    });
  });
});

describe('getRiskLevel: casos que antes se clasificaban mal (C1)', () => {
  // Con redondeo a 2 decimales estos puntajes caían en huecos y salían 'riesgo_medio'.
  // Con la clasificación oficial (baremos a 1 decimal) caen donde corresponde.
  test('liderazgo Forma A: 3.8 es sin_riesgo (no riesgo_medio)', () => {
    expect(getRiskLevel(3.8, BAREMOS_BRS.intralaboral_forma_a.dimensiones.caracteristicas_liderazgo)).toBe('sin_riesgo');
  });
  test('control y autonomía Forma A: 8.3 es sin_riesgo', () => {
    expect(getRiskLevel(8.3, BAREMOS_BRS.intralaboral_forma_a.dimensiones.control_autonomia)).toBe('sin_riesgo');
  });
  test('relaciones sociales Forma A: 60.7 es riesgo_muy_alto (Ejemplo 6 del manual)', () => {
    expect(getRiskLevel(60.7, BAREMOS_BRS.intralaboral_forma_a.dimensiones.relaciones_sociales_trabajo)).toBe('riesgo_muy_alto');
  });
});
