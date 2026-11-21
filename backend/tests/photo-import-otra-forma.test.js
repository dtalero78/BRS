// Freightwise (nov-2026): una persona escaneada primero como Forma B y luego
// como Forma A quedaba con resultados de las dos formas y el informe contaba
// una persona de más en el intralaboral. Al guardar una forma se retira la otra.
jest.mock('../config/database', () => ({}));
jest.mock('../middleware/auth', () => ({
  auth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  getOwnedCompanyIds: async () => [],
}));
const { _retirarOtraFormaIntralaboral: retirar } = require('../routes/photo-import');

function fakeTrx() {
  const calls = [];
  const trx = (table) => {
    const q = { table, where: {} };
    const chain = {
      where(col, val) { q.where[col] = val; return chain; },
      del() { calls.push(q); return Promise.resolve(1); },
    };
    return chain;
  };
  return { trx, calls };
}

describe('retirarOtraFormaIntralaboral', () => {
  test('subir Forma A borra respuestas y resultados de Forma B del mismo PE', async () => {
    const { trx, calls } = fakeTrx();
    await retirar(trx, 5193, 'intralaboral_a');
    expect(calls).toEqual([
      { table: 'results', where: { participant_evaluation_id: 5193, questionnaire_type: 'intralaboral_b' } },
      { table: 'responses', where: { participant_evaluation_id: 5193, questionnaire_type: 'intralaboral_b' } },
    ]);
  });

  test('subir Forma B borra la Forma A', async () => {
    const { trx, calls } = fakeTrx();
    await retirar(trx, 5053, 'intralaboral_b');
    expect(calls.map(c => c.where.questionnaire_type)).toEqual(['intralaboral_a', 'intralaboral_a']);
  });

  test.each(['extralaboral', 'estres', 'ficha_datos', 'coping'])('%s no toca ningún intralaboral', async (tipo) => {
    const { trx, calls } = fakeTrx();
    expect(await retirar(trx, 1, tipo)).toBe(0);
    expect(calls).toEqual([]);
  });
});

const { _recalcularPorGrupoOcupacional: recalcular } = require('../routes/photo-import');
const calculateResults = require('../utils/calculate-results');

function fakeTrxConFilas(filas) {
  const inserts = [];
  const trx = (table) => {
    const chain = {
      where() { return chain; }, whereIn() { return chain; }, whereNotNull() { return chain; },
      select() { return Promise.resolve(table === 'responses' ? filas : []); },
      del() { return Promise.resolve(1); },
      insert(row) { inserts.push(row); return Promise.resolve(); },
    };
    return chain;
  };
  return { trx, inserts };
}

describe('recalcularPorGrupoOcupacional', () => {
  // Respuestas de extralaboral de Juan Pablo (Freightwise), tal como se guardan.
  const extra = {"1":2,"2":2,"3":2,"4":3,"5":2,"6":2,"7":2,"8":3,"9":3,"10":3,"11":4,"12":4,"13":3,"14":2,"15":2,"16":2,"17":2,"18":2,"19":2,"20":2,"21":2,"22":3,"23":2,"24":1,"25":3,"26":2,"27":3,"28":2,"29":3,"30":1,"31":1};
  const formatted = Object.entries(extra).map(([k, v]) => ({ question_number: Number(k), response_value: v }));

  test.each([['A', 'jefes'], ['B', 'auxiliares']])('Forma %s califica extralaboral con baremo de %s', async (forma, grupo) => {
    const { trx, inserts } = fakeTrxConFilas([{ questionnaire_type: 'extralaboral', responses: extra }]);
    expect(await recalcular(trx, 1, forma)).toBe(1);
    const esperado = (await calculateResults('extralaboral', formatted, { occupationalGroup: grupo }))
      .map(r => r.riskLevel);
    expect(JSON.parse(inserts[0].results).map(r => r.riskLevel)).toEqual(esperado);
  });

  test('los baremos de jefes y auxiliares de verdad difieren para estas respuestas', async () => {
    const j = await calculateResults('extralaboral', formatted, { occupationalGroup: 'jefes' });
    const a = await calculateResults('extralaboral', formatted, { occupationalGroup: 'auxiliares' });
    expect(j.map(r => r.riskLevel)).not.toEqual(a.map(r => r.riskLevel));
  });

  test('no recalcula lo que la misma petición ya trae', async () => {
    const { trx, inserts } = fakeTrxConFilas([]);
    expect(await recalcular(trx, 1, 'A', ['extralaboral', 'estres'])).toBe(0);
    expect(inserts).toEqual([]);
  });
});

test('una fila vacía marcada terminada (Excel mínimo viejo) se salta, no tumba la subida', async () => {
  const { trx, inserts } = fakeTrxConFilas([
    { questionnaire_type: 'extralaboral', responses: {} },
    { questionnaire_type: 'estres', responses: [] },
  ]);
  await expect(recalcular(trx, 5064, 'A')).resolves.toBe(0);
  expect(inserts).toEqual([]);
});
