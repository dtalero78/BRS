const { canonicalSede, parseYearsValue } = require('../utils/report-data-aggregator');

// Valores reales de la ficha de Universidad Manuela Beltrán (eval 419),
// reportado el 2026-11-12: cada forma de escribir Bogotá abría su propia
// sección "RESULTADOS: <sede>" en el informe organizacional.
describe('canonicalSede', () => {
  test('todas las formas de escribir Bogotá caen en una sola sede', () => {
    const variantes = [
      'Bogotá', 'BOGOTA', 'Bogota ', 'bogota', 'BOGOTÁ', 'Bogotá    ',
      'Bogotá D.C.', 'Bogotá D.C', 'BOGOTA D C', 'BOGOTA D.C.', 'BOGOTÁ D.C.',
      'Bogotá DC.', 'Bogotá, D.C.', 'BOGOTÁ, D. C.', 'Bogotá, d. c.', 'Bogota D,C,',
      'Bogota dc', 'BOGOTA DF', 'Distrito Capital de Bogotá',
      'DISTRITO CAPITAL', 'Distrito capital ', 'distrito c', 'D.C',
      'Por favor seleccione...bogotá ',
    ];
    for (const v of variantes) {
      expect(canonicalSede(v)).toEqual({ key: 'bogota d c', label: 'Bogotá D.C.' });
    }
  });

  test('las demás sedes solo se fusionan por formato', () => {
    const keys = ['Santander', 'santander', 'SANTANDER ', 'Santander '].map(v => canonicalSede(v).key);
    expect(new Set(keys).size).toBe(1);
    expect(canonicalSede('SANTANDER').label).toBe('Santander');
  });

  // Cundinamarca no es Bogotá: en otra empresa puede ser Soacha o Chía.
  test('Cundinamarca no se junta con Bogotá', () => {
    expect(canonicalSede('Cundinamarca').key).not.toBe('bogota d c');
  });

  test('conserva las tildes en la etiqueta', () => {
    expect(canonicalSede('MEDELLÍN').label).toBe('Medellín');
  });

  test('vacío', () => {
    expect(canonicalSede('')).toBeNull();
    expect(canonicalSede('   ')).toBeNull();
    expect(canonicalSede(null)).toBeNull();
  });
});

describe('parseYearsValue', () => {
  // La casilla oficial de la ficha guarda este texto literal: 114 personas
  // de Manuela Beltrán quedaban fuera de "Antigüedad en la empresa".
  test('la casilla "menos de un año" cuenta como menos de 1 año', () => {
    expect(parseYearsValue('Si lleva menos de un año marque esta opción')).toBeLessThan(1);
    expect(parseYearsValue('menos de 1 año')).toBeLessThan(1);
  });

  test('números y meses siguen igual', () => {
    expect(parseYearsValue('3')).toBe(3);
    expect(parseYearsValue('6 meses')).toBe(0.5);
    expect(parseYearsValue('2 años')).toBe(2);
  });
});
