// "¿Se pueden tener las preguntas que más riesgo tuvieron?" (nov-2026).
const { analyzeItemRisk, isRiskAnswer, questionTexts, itemDimension } = require('../utils/item-risk-analysis');

describe('isRiskAnswer: misma dirección que el motor oficial', () => {
  test('ítem negativo (A-17 "Mi trabajo me exige estar muy concentrado"): Siempre/Casi siempre', () => {
    expect([4, 3, 2, 1, 0].map(v => isRiskAnswer('intralaboral_a', 17, v))).toEqual([true, true, false, false, false]);
  });
  test('ítem protector (A-4 "El aire … es fresco y agradable"): Nunca/Casi nunca', () => {
    expect([4, 3, 2, 1, 0].map(v => isRiskAnswer('intralaboral_a', 4, v))).toEqual([false, false, false, true, true]);
  });
  test('B-97 "Puedo expresar tristeza o enojo…" es protector', () => {
    expect(isRiskAnswer('intralaboral_b', 97, 0)).toBe(true);
    expect(isRiskAnswer('intralaboral_b', 97, 4)).toBe(false);
  });
  test('estrés (guardado 0-3): Siempre y Casi siempre', () => {
    expect([3, 2, 1, 0].map(v => isRiskAnswer('estres', 1, v))).toEqual([true, true, false, false]);
  });
});

describe('catálogo', () => {
  test.each([['intralaboral_a', 123], ['intralaboral_b', 97], ['extralaboral', 31], ['estres', 31]])(
    '%s tiene texto y dimensión para sus %i ítems', (t, n) => {
      const textos = questionTexts(t);
      for (let i = 1; i <= n; i++) {
        expect(textos[i]).toBeTruthy();
        expect(itemDimension(t, i)).toBeTruthy();
      }
    });
});

describe('analyzeItemRisk', () => {
  const persona = (v17, v4) => ({ responses: { 17: v17, 4: v4 } });

  test('ordena por porcentaje y dice qué respuesta es de riesgo', () => {
    const filas = [persona(4, 0), persona(4, 0), persona(3, 4), persona(0, 4), persona(4, 1)];
    const r = analyzeItemRisk('intralaboral_a', filas);
    expect(r.respondents).toBe(5);
    expect(r.items.map(i => [i.numero, i.enRiesgo, i.respondieron, i.pct, i.respuestaRiesgo])).toEqual([
      [17, 4, 5, 80, 'Siempre / Casi siempre'],
      [4, 3, 5, 60, 'Nunca / Casi nunca'],
    ]);
  });

  test('acepta el formato arreglo del flujo por token', () => {
    const filas = Array.from({ length: 5 }, () => ({ responses: [{ questionNumber: 1, responseValue: 3 }] }));
    expect(analyzeItemRisk('estres', filas).items[0]).toMatchObject({ numero: 1, pct: 100, dimension: 'Síntomas fisiológicos' });
  });

  test('con menos de 5 personas no se publica (porcentaje sin sentido y deja identificar)', () => {
    expect(analyzeItemRisk('intralaboral_a', [persona(4, 0), persona(4, 0)])).toBeNull();
  });

  test('un ítem que respondieron menos de 5 (p. ej. atención a clientes) se omite', () => {
    const filas = [
      { responses: { 17: 4, 106: 4 } }, { responses: { 17: 4, 106: 4 } },
      { responses: { 17: 4 } }, { responses: { 17: 4 } }, { responses: { 17: 4 } },
    ];
    expect(analyzeItemRisk('intralaboral_a', filas).items.map(i => i.numero)).toEqual([17]);
  });

  test('valores fuera de escala no cuentan', () => {
    const filas = Array.from({ length: 5 }, () => ({ responses: { 17: 9 } }));
    expect(analyzeItemRisk('intralaboral_a', filas)).toBeNull();
  });
});

describe('respuestas vacías y en conflicto (misma regla que buildResponseMap)', () => {
  test('null y "" no cuentan como "Nunca"', () => {
    const filas = Array.from({ length: 5 }, (_, i) => ({ responses: { 4: i % 2 ? null : '', 17: 4 } }));
    const r = analyzeItemRisk('intralaboral_a', filas);
    expect(r.items.map(i => i.numero)).toEqual([17]);
  });
  test('un ítem respondido dos veces con valores distintos se descarta', () => {
    const filas = Array.from({ length: 5 }, () => ({ responses: [
      { questionNumber: 17, responseValue: 4 }, { questionNumber: 17, responseValue: 0 },
      { questionNumber: 21, responseValue: '4' },
    ] }));
    expect(analyzeItemRisk('intralaboral_a', filas).items.map(i => i.numero)).toEqual([21]);
  });
});
