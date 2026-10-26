const { calculateSofiResults, classifyFatigue, DIMENSIONS, TOTAL_ITEMS } = require('../utils/calculate-sofi');
const preguntas = require('../../bateria_riesgo_psicosocial_preguntas.json');

function responder(valores) {
  // valores: { [numeroItem]: valor } o un valor único para los 18
  return Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
    question_number: i + 1,
    response_value: typeof valores === 'number' ? valores : valores[i + 1]
  }));
}

function porDimension(resultados) {
  return Object.fromEntries(resultados.map(r => [r.dimension, r]));
}

describe('estructura del SOFI-SM', () => {
  test('6 dimensiones de 3 ítems que cubren los 18 sin repetir', () => {
    const items = Object.values(DIMENSIONS).flatMap(d => d.items);
    expect(Object.keys(DIMENSIONS)).toHaveLength(6);
    expect(items).toHaveLength(18);
    expect(new Set(items).size).toBe(18);
    expect(Math.min(...items)).toBe(1);
    expect(Math.max(...items)).toBe(18);
  });

  // El motor y el JSON que ve el participante son dos copias de la misma
  // asignación ítem → dimensión: si se separan, el puntaje se calcula con
  // otras preguntas que las que se mostraron.
  test('el JSON de preguntas asigna cada ítem a la misma dimensión que el motor', () => {
    const sofi = preguntas.cuestionarios.sofi;
    expect(sofi.total_preguntas).toBe(18);
    expect(sofi.preguntas).toHaveLength(18);
    for (const [key, dim] of Object.entries(DIMENSIONS)) {
      const enJson = sofi.preguntas.filter(p => p.dimension === key).map(p => p.numero).sort((a, b) => a - b);
      expect(enJson).toEqual([...dim.items].sort((a, b) => a - b));
    }
  });
});

describe('calculateSofiResults', () => {
  test('todo en 0 da 0 en todas las dimensiones y nivel aceptable', () => {
    const r = porDimension(calculateSofiResults(responder(0)));
    for (const key of Object.keys(DIMENSIONS)) {
      expect(r[key].transformedScore).toBe(0);
      expect(r[key].riskLevel).toBe('aceptable');
    }
    expect(r.sofi_ssm_index.transformedScore).toBe(0);
  });

  test('todo en 10 da 100 y nivel inaceptable', () => {
    const r = porDimension(calculateSofiResults(responder(10)));
    expect(r.falta_energia.rawScore).toBe(30);
    expect(r.falta_energia.transformedScore).toBe(100);
    expect(r.sofi_ssm_index.transformedScore).toBe(100);
    expect(r.sofi_ssm_index.riskLevel).toBe('inaceptable');
  });

  test('dimensión = suma × 100 / 30 y SSM = promedio de las 6 dimensiones', () => {
    // Falta de energía (1, 12, 15) = 9 → 30; irritabilidad (3, 11, 16) = 18 → 60; resto 0.
    const valores = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 0]));
    Object.assign(valores, { 1: 3, 12: 3, 15: 3, 3: 6, 11: 6, 16: 6 });
    const r = porDimension(calculateSofiResults(responder(valores)));
    expect(r.falta_energia.transformedScore).toBe(30);
    expect(r.irritabilidad.transformedScore).toBe(60);
    expect(r.irritabilidad.riskLevel).toBe('inadecuado_ii');
    expect(r.sofi_ssm_index.transformedScore).toBe(15);
  });

  test('un ítem sin responder deja su dimensión y el SSM-Index en null, no en 0', () => {
    const respuestas = responder(5).filter(x => x.question_number !== 6); // somnolencia
    const r = porDimension(calculateSofiResults(respuestas));
    expect(r.somnolencia.transformedScore).toBeNull();
    expect(r.somnolencia.riskLevel).toBeNull();
    expect(r.sofi_ssm_index.transformedScore).toBeNull();
    expect(r.falta_energia.transformedScore).toBe(50);
  });

  test('valores fuera de 0-10 cuentan como no respondidos', () => {
    const respuestas = responder(5).map(x => (x.question_number === 1 ? { ...x, response_value: 11 } : x));
    const r = porDimension(calculateSofiResults(respuestas));
    expect(r.falta_energia.transformedScore).toBeNull();
  });
});

describe('classifyFatigue: franjas de los autores sobre el valor redondeado', () => {
  test.each([
    [0, 'aceptable'], [25, 'aceptable'], [25.4, 'aceptable'],
    [25.5, 'inadecuado'], [26, 'inadecuado'], [50, 'inadecuado'],
    [51, 'inadecuado_ii'], [75, 'inadecuado_ii'], [75.5, 'inaceptable'], [100, 'inaceptable']
  ])('%p → %p', (score, nivel) => {
    expect(classifyFatigue(score)).toBe(nivel);
  });
});
