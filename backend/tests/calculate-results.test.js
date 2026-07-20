const calculateResults = require('../utils/calculate-results');

// Construye un set de respuestas completo (preguntas 1..n con el mismo valor).
function fullResponses(n, value) {
  const out = [];
  for (let q = 1; q <= n; q++) out.push({ question_number: q, response_value: value });
  return out;
}

// Un puntaje transformado válido debe tener a lo sumo 1 decimal (regla del manual).
function atMostOneDecimal(x) {
  return x == null || Math.round(x * 10) === x * 10;
}

describe('Motor de cálculo: regla oficial de 1 decimal (C1)', () => {
  test('Forma A completa: 19 dimensiones, dominios y total, todos a 1 decimal', async () => {
    const res = await calculateResults('intralaboral_a', fullResponses(123, 2), { occupationalGroup: 'jefes' });
    const dims = res.filter(r => !r.isDomainTotal && !r.isTotal);
    expect(dims.length).toBe(19);
    expect(res.find(r => r.isTotal)).toBeDefined();
    for (const r of res) {
      expect(atMostOneDecimal(r.transformedScore)).toBe(true);
      expect(r.riskLevel).toBeTruthy();
    }
  });

  test('Extralaboral completo: dimensiones + total, todos a 1 decimal', async () => {
    const res = await calculateResults('extralaboral', fullResponses(31, 2), { occupationalGroup: 'jefes' });
    expect(res.find(r => r.isTotal)).toBeDefined();
    for (const r of res) expect(atMostOneDecimal(r.transformedScore)).toBe(true);
  });

  test('Estrés completo: total a 1 decimal (antes redondeaba a 2)', async () => {
    const res = await calculateResults('estres', fullResponses(31, 2), { occupationalGroup: 'jefes' });
    const total = res.find(r => r.isTotal);
    expect(total).toBeDefined();
    expect(atMostOneDecimal(total.transformedScore)).toBe(true);
    expect(total.riskLevel).toBeTruthy();
  });

  test('ningún puntaje transformado, en ningún cuestionario, queda con más de 1 decimal', async () => {
    const forms = [
      ['intralaboral_a', 123],
      ['intralaboral_b', 97],
      ['extralaboral', 31],
      ['estres', 31],
    ];
    for (const [type, n] of forms) {
      for (const v of [0, 1, 2, 3, 4]) {
        const res = await calculateResults(type, fullResponses(n, Math.min(v, type === 'estres' ? 3 : 4)));
        const offenders = res.filter(r => !atMostOneDecimal(r.transformedScore));
        expect(offenders.map(o => `${type}:${o.dimension}=${o.transformedScore}`)).toEqual([]);
      }
    }
  });
});

describe('Motor de cálculo: validación de rango de respuestas (A7)', () => {
  test('un valor fuera de rango (>4) no se inyecta al puntaje bruto', async () => {
    const responses = fullResponses(123, 2);
    responses[0].response_value = 999; // ítem 1 con valor imposible
    const res = await calculateResults('intralaboral_a', responses, { occupationalGroup: 'jefes' });
    // Ningún puntaje transformado debe salir del rango válido [0,100]
    for (const r of res) {
      if (r.transformedScore != null) {
        expect(r.transformedScore).toBeGreaterThanOrEqual(0);
        expect(r.transformedScore).toBeLessThanOrEqual(100);
      }
    }
  });

  test('un valor negativo no produce puntaje bruto negativo', async () => {
    const responses = fullResponses(123, 2);
    responses[5].response_value = -3;
    const res = await calculateResults('intralaboral_a', responses, { occupationalGroup: 'jefes' });
    for (const r of res) {
      if (r.rawScore != null) expect(r.rawScore).toBeGreaterThanOrEqual(0);
    }
  });

  test('estrés: un valor fuera de la escala 0-3 se ignora (no se mapea a 0)', async () => {
    const responses = fullResponses(31, 2);
    responses[0].response_value = 7; // fuera de escala → se trata como no respondido (A7)
    const withBad = await calculateResults('estres', responses);
    // Como el ítem queda sin responder y el estrés exige los 31 (C2), el total pasa
    // a no_calculable en vez de mapear la basura a 0 e inflar el puntaje.
    const t = withBad.find(r => r.isTotal);
    expect(t.riskLevel).toBe('no_calculable');
    expect(t.valid).toBe(false);
  });
});

describe('Motor de cálculo: regla de ítems mínimos (C2, Manual Paso 2)', () => {
  const without = (n, ...qs) => fullResponses(n, 2).filter(r => !qs.includes(r.question_number));

  test('Forma A: dimensión no-lenient con 1 ítem faltante → no_calculable en dimensión, dominio y total', async () => {
    // claridad_rol = ítems 53-59 (7, no lenient); dominio control_trabajo.
    const res = await calculateResults('intralaboral_a', without(123, 53), { occupationalGroup: 'jefes' });
    const dim = res.find(r => r.dimension === 'claridad_rol');
    expect(dim.riskLevel).toBe('no_calculable');
    expect(dim.valid).toBe(false);
    expect(dim.transformedScore).toBeNull();
    expect(res.find(r => r.dimension === 'control_trabajo_total').riskLevel).toBe('no_calculable');
    expect(res.find(r => r.isTotal).riskLevel).toBe('no_calculable');
  });

  test('Forma A: dimensión lenient con 1 ítem faltante → sigue válida', async () => {
    // caracteristicas_liderazgo = ítems 63-75 (13, lenient: admite 1 faltante).
    const res = await calculateResults('intralaboral_a', without(123, 63), { occupationalGroup: 'jefes' });
    const dim = res.find(r => r.dimension === 'caracteristicas_liderazgo');
    expect(dim.valid).toBe(true);
    expect(dim.riskLevel).not.toBe('no_calculable');
    expect(res.find(r => r.isTotal).valid).toBe(true);
  });

  test('Forma A: sección de filtro (demandas_emocionales) sin respuestas → puntaje bruto 0, válida, sin_riesgo', async () => {
    // ítems 106-114 en blanco = "no brinda servicio a clientes" → raw 0 automático.
    const res = await calculateResults('intralaboral_a', without(123, 106, 107, 108, 109, 110, 111, 112, 113, 114), { occupationalGroup: 'jefes' });
    const dim = res.find(r => r.dimension === 'demandas_emocionales');
    expect(dim.valid).toBe(true);
    expect(dim.rawScore).toBe(0);
    expect(dim.riskLevel).toBe('sin_riesgo');
    expect(res.find(r => r.isTotal).valid).toBe(true); // el total sigue calculándose
  });

  test('Extralaboral: dimensión no-lenient con 1 ítem faltante → no_calculable en dimensión y total', async () => {
    // tiempo_fuera_trabajo = ítems 14-17 (no lenient).
    const res = await calculateResults('extralaboral', without(31, 14), { occupationalGroup: 'jefes' });
    expect(res.find(r => r.dimension === 'tiempo_fuera_trabajo').riskLevel).toBe('no_calculable');
    expect(res.find(r => r.isTotal).riskLevel).toBe('no_calculable');
  });

  test('Extralaboral: características de la vivienda (lenient) con 1 ítem faltante → válida', async () => {
    const res = await calculateResults('extralaboral', without(31, 5), { occupationalGroup: 'jefes' });
    expect(res.find(r => r.dimension === 'caracteristicas_vivienda').valid).toBe(true);
    expect(res.find(r => r.isTotal).valid).toBe(true);
  });

  test('Estrés: falta 1 ítem de los 31 → total no_calculable', async () => {
    const res = await calculateResults('estres', without(31, 1));
    const t = res.find(r => r.isTotal);
    expect(t.riskLevel).toBe('no_calculable');
    expect(t.valid).toBe(false);
  });

  test('formas completas siguen siendo todas válidas (sin regresión)', async () => {
    const a = await calculateResults('intralaboral_a', fullResponses(123, 2), { occupationalGroup: 'jefes' });
    expect(a.every(r => r.valid === true)).toBe(true);
    const e = await calculateResults('estres', fullResponses(31, 2));
    expect(e.find(r => r.isTotal).valid).toBe(true);
  });
});

describe('Motor: doble marcación (questionNumber duplicado)', () => {
  test('mismo questionNumber con valores DISTINTOS → ítem como no respondido (dimensión no_calculable)', async () => {
    // claridad_rol = ítems 53-59 (no lenient). Ítem 53 duplicado con otro valor → dato perdido.
    const responses = fullResponses(123, 2);
    responses.push({ question_number: 53, response_value: 4 });
    const res = await calculateResults('intralaboral_a', responses, { occupationalGroup: 'jefes' });
    expect(res.find(r => r.dimension === 'claridad_rol').riskLevel).toBe('no_calculable');
  });

  test('mismo questionNumber con el MISMO valor → se conserva (no invalida)', async () => {
    const responses = fullResponses(123, 2);
    responses.push({ question_number: 53, response_value: 2 });
    const res = await calculateResults('intralaboral_a', responses, { occupationalGroup: 'jefes' });
    expect(res.find(r => r.dimension === 'claridad_rol').valid).toBe(true);
  });
});
