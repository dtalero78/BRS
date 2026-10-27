const { accumulateFreeText } = require('../utils/report-data-aggregator');

// Reportado el 2026-10-27: la grafica "Distribucion por Departamento / Area"
// del informe organizacional solo mostraba 15 de 30 participantes reales
// (el chart cortaba a las 8 areas mas grandes y descartaba el resto sin
// avisar) y los nombres de area salian truncados. `accumulateFreeText` ataca
// la parte de conteo: a diferencia de groupMaritalStatus/groupTipoVivienda,
// "departamento/area" es de escritura libre (sin lista oficial cerrada), asi
// que no se clasifica por palabras clave - solo se fusionan variantes
// LITERALES (mayusculas/tildes/espacios) del mismo valor.
describe('accumulateFreeText: fusiona solo variantes literales, no sinonimos', () => {
  test('mayusculas/minusculas del mismo valor se fusionan bajo la primera grafia vista', () => {
    const acc = {};
    const keys = {};
    accumulateFreeText(acc, keys, 'Produccion');
    accumulateFreeText(acc, keys, 'PRODUCCIÓN');
    accumulateFreeText(acc, keys, 'producción');
    expect(acc).toEqual({ Produccion: 3 });
  });

  test('espacios extra no abren una barra nueva', () => {
    const acc = {};
    const keys = {};
    accumulateFreeText(acc, keys, 'Recursos Humanos');
    accumulateFreeText(acc, keys, '  Recursos   Humanos  ');
    expect(acc).toEqual({ 'Recursos Humanos': 2 });
  });

  // Caso real reportado: dos nombres de area distintos NO deben fusionarse
  // solo porque comparten palabras - uno es la sede general y el otro una
  // sede municipal especifica, y adivinar que son "la misma area" inventaria
  // un dato que nadie confirmo.
  test('nombres de area distintos (no solo variantes de formato) quedan separados', () => {
    const acc = {};
    const keys = {};
    accumulateFreeText(acc, keys, 'Cuerpo voluntario de bomberos');
    accumulateFreeText(acc, keys, 'CUERPO DE BOMBEROS VOLUNTARIO DE TAURAMENA');
    expect(Object.keys(acc)).toHaveLength(2);
    expect(acc['Cuerpo voluntario de bomberos']).toBe(1);
    expect(acc['CUERPO DE BOMBEROS VOLUNTARIO DE TAURAMENA']).toBe(1);
  });

  test('valor vacio no se cuenta', () => {
    const acc = {};
    const keys = {};
    accumulateFreeText(acc, keys, '');
    accumulateFreeText(acc, keys, '   ');
    expect(acc).toEqual({});
  });
});
