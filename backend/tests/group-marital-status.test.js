const { groupMaritalStatus, groupTipoVivienda } = require('../utils/report-data-aggregator');

// Mismo bug que groupEducation pero sin ninguna normalizacion previa: antes
// se usaba el literal crudo como llave del conteo (`base.estadoCivil[valor]++`).
// Reportado el 2026-10-16: la grafica "Participacion por Estado Civil" del
// informe organizacional mostraba "Soltero(a)" y "Soltero (a)" como dos
// barras separadas para la misma respuesta. Estos son los 18 valores reales
// de produccion (defaultdb + brs_shaddai) sobre las 7 categorias oficiales.
describe('groupMaritalStatus: variantes reales de produccion', () => {
  test('todas las formas de escribir soltero(a) caen en Soltero(a)', () => {
    for (const v of ['Soltero(a)', 'SOLTERO (A)', 'Soltero (a)', 'Soltero']) {
      expect(groupMaritalStatus(v)).toBe('Soltero(a)');
    }
  });
  test('casado(a), con y sin espacio antes del parentesis', () => {
    for (const v of ['Casado(a)', 'CASADO (A)', 'Casado (a)']) {
      expect(groupMaritalStatus(v)).toBe('Casado(a)');
    }
  });
  test('union libre, con mayusculas y tildes distintas', () => {
    for (const v of ['Unión libre', 'UNIÓN LIBRE', 'Union Libre']) {
      expect(groupMaritalStatus(v)).toBe('Unión libre');
    }
  });
  test('separado(a), divorciado(a), viudo(a)', () => {
    expect(groupMaritalStatus('SEPARADO (A)')).toBe('Separado(a)');
    expect(groupMaritalStatus('Separado (a)')).toBe('Separado(a)');
    expect(groupMaritalStatus('DIVORCIADO (A)')).toBe('Divorciado(a)');
    expect(groupMaritalStatus('VIUDO (A)')).toBe('Viudo(a)');
  });
  test('sacerdote/monja (septima opcion oficial, poco usada)', () => {
    expect(groupMaritalStatus('SACERDOTE/MONJA')).toBe('Sacerdote/Monja');
  });

  // Fundación San Martín (eval 12): 213 fichas tienen aquí un valor de TIPO
  // DE SALARIO, no de estado civil — el campo quedó cruzado al importar ese
  // Excel. No es parte de este arreglo: se muestra tal cual, como señal de
  // que ese dato hay que revisarlo, en vez de forzarlo a una categoría que
  // nadie marcó.
  test('un valor que es de otro campo (dato cruzado) se devuelve tal cual, no se esconde', () => {
    expect(groupMaritalStatus('FIJO (DIARIO, QUINCENAL, SEMANAL, MENSUAL)'))
      .toBe('FIJO (DIARIO, QUINCENAL, SEMANAL, MENSUAL)');
    expect(groupMaritalStatus('UNA PARTE FIJA Y OTRA VARIABLE'))
      .toBe('UNA PARTE FIJA Y OTRA VARIABLE');
  });

  test('sin dato', () => {
    expect(groupMaritalStatus('')).toBe('');
    expect(groupMaritalStatus(null)).toBeNull();
  });
});

describe('groupTipoVivienda: variantes reales de produccion', () => {
  test('mayusculas/minusculas de las 3 opciones oficiales', () => {
    expect(groupTipoVivienda('Propia')).toBe('Propia');
    expect(groupTipoVivienda('PROPIA')).toBe('Propia');
    expect(groupTipoVivienda('En arriendo')).toBe('En arriendo');
    expect(groupTipoVivienda('EN ARRIENDO')).toBe('En arriendo');
    expect(groupTipoVivienda('Familiar')).toBe('Familiar');
    expect(groupTipoVivienda('FAMILIAR')).toBe('Familiar');
  });

  // Un valor numerico suelto ("2", "3"...) es de ESTRATO filtrado por error
  // a este campo en varias evaluaciones de Shaddai — mismo patron de campo
  // cruzado que el de estado civil. Se devuelve tal cual, no se inventa una
  // vivienda.
  test('un valor que es de otro campo (estrato cruzado) se devuelve tal cual', () => {
    expect(groupTipoVivienda('2')).toBe('2');
    expect(groupTipoVivienda('No sé')).toBe('No sé');
  });

  test('sin dato', () => {
    expect(groupTipoVivienda('')).toBe('');
  });
});
