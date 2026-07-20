const { parseResponseValue } = require('../utils/excel-import-detector');

describe('parseResponseValue: dirección de escala numérica (A10)', () => {
  test('inverted (default, formato oficial): Excel Siempre=0 → BRS 4', () => {
    expect(parseResponseValue(0, 'intra')).toBe(4);
    expect(parseResponseValue(4, 'intra')).toBe(0);
    expect(parseResponseValue(2, 'intra')).toBe(2);
  });

  test('direct: Excel ya en escala BRS (Siempre=4) se toma tal cual', () => {
    expect(parseResponseValue(4, 'intra', 'direct')).toBe(4);
    expect(parseResponseValue(0, 'intra', 'direct')).toBe(0);
    expect(parseResponseValue(1, 'intra', 'direct')).toBe(1);
  });

  test('las etiquetas de texto son inequívocas (no dependen de la dirección)', () => {
    expect(parseResponseValue('Siempre', 'intra')).toBe(4);
    expect(parseResponseValue('Siempre', 'intra', 'direct')).toBe(4);
    expect(parseResponseValue('Nunca', 'intra')).toBe(0);
  });

  test('valores fuera de rango → null (no se inyectan)', () => {
    expect(parseResponseValue(9, 'intra')).toBeNull();
    expect(parseResponseValue(-1, 'intra')).toBeNull();
    expect(parseResponseValue(4, 'stress')).toBeNull(); // estrés es 0-3
    expect(parseResponseValue(3, 'stress')).toBe(0);     // inverted: 3 → 0
  });

  test('vacío/nulo → null', () => {
    expect(parseResponseValue('', 'intra')).toBeNull();
    expect(parseResponseValue(null, 'intra')).toBeNull();
    expect(parseResponseValue(undefined, 'intra')).toBeNull();
  });
});
