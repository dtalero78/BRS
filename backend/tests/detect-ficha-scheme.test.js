const { resolveFicha } = require('../utils/report-data-aggregator');

// Reportado el 2026-10-28 (FUNDACION CORPORACION PROSPERAR, instancia Shaddai,
// 4 participantes completados): el detallado de la empresa mostraba 100%,
// pero "Participacion por Estado Civil", "Antiguedad en la empresa" y el
// gauge "RESULTADOS: BOGOTA" solo contaban 3 de 4 personas.
//
// Root cause: detectFichaScheme() distinguia los dos flujos de captura
// ('photo'/OCR vs 'official'/token web) mirando si Q13 o Q14 matcheaban un
// regex de categorias de cargo. El cargo real de la persona contenia
// "asistente" tanto en el puesto libre (Q13="asistente presidencia") como en
// la categoria oficial (Q14="Auxiliar, asistente administrativo, asistente
// tecnico"), asi que el heuristico quedaba en empate y caia al default
// 'official' para una ficha que fisicamente era 'photo' (18 claves, sin
// clave 19). Con el esquema equivocado el mapeo de TODA la ficha corria una
// posicion: estado civil, antiguedad, ciudad de trabajo y cargo quedaban
// vacios o con el valor de otra pregunta.
//
// Esta es una reconstruccion fiel de esa ficha real (valores tomados del
// diagnostico contra produccion), en numeracion fisica 'photo' (fecha=1,
// sexo=2, birthYear=3, education=4, maritalStatus=5, ocupacion=6,
// ciudadResidencia=7, estrato=8, dependientes=9, tipoVivienda=10,
// ciudadTrabajo=11, anosEmpresa=12, cargo=13, tipoCargo=14, anosCargo=15,
// departamento=16, tipoContrato=17, horasTrabajo=18 - sin clave 19).
function fichaProsperarReal() {
  return {
    1: '46134', // serial de Excel, sin separadores
    2: 'Femenino',
    3: '1985',
    4: 'Bachillerato completo',
    5: 'Soltera',
    6: 'Secretaria',
    7: 'Bogotá',
    8: '3',
    9: '0',
    10: 'Propia',
    11: 'Bogotá',
    12: 'Menos de 1 año',
    13: 'asistente presidencia',
    14: 'Auxiliar, asistente administrativo, asistente técnico',
    15: '1',
    16: 'Presidencia',
    17: 'Indefinido',
    18: '8',
  };
}

describe('detectFichaScheme (via resolveFicha): cargo ambiguo "asistente" en Q13 y Q14', () => {
  test('una ficha photo real se detecta como photo, no official', () => {
    const ficha = resolveFicha(fichaProsperarReal());
    expect(ficha._scheme).toBe('photo');
  });

  test('con el esquema correcto, los campos que antes desaparecian de las graficas quedan resueltos', () => {
    const ficha = resolveFicha(fichaProsperarReal());
    expect(ficha.maritalStatus).toBe('Soltera');
    expect(ficha.ciudadTrabajo).toBe('Bogotá');
    expect(ficha.anosEmpresa).toBe('Menos de 1 año');
    expect(ficha.cargo).toBe('asistente presidencia');
    expect(ficha.tipoCargo).toContain('Auxiliar');
  });

  // Antes del fix, el mismo heuristico SI distinguia correctamente cuando
  // solo uno de los dos (Q13/Q14) matcheaba una categoria de cargo - eso no
  // debia romperse.
  test('sigue detectando photo cuando el heuristico de Q13/Q14 no esta empatado', () => {
    const f = fichaProsperarReal();
    f[13] = 'Coordinador de bodega'; // no matchea ninguna categoria oficial
    const ficha = resolveFicha(f);
    expect(ficha._scheme).toBe('photo');
  });

  test('sigue detectando official para una ficha real de ese esquema (19 claves)', () => {
    const fichaOfficial = {
      1: 'Carlos Ruiz',
      2: 'Masculino',
      3: '1990',
      4: 'Profesional',
      5: 'Ingeniero de sistemas', // Q5 = ocupacion en official, texto libre
      6: 'Bogotá',
      7: '4',
      8: 'Propia',
      9: '2',
      10: 'Bogotá',
      11: '5',
      12: 'Analista',
      13: 'Jefatura',
      14: '3',
      15: 'Tecnología',
      16: 'Indefinido',
      17: '8',
      18: 'Fijo',
      19: 'Casado(a)',
    };
    const ficha = resolveFicha(fichaOfficial);
    expect(ficha._scheme).toBe('official');
    expect(ficha.maritalStatus).toBe('Casado(a)');
  });
});
