const { toResponseList, toResponseMap } = require('../utils/response-format');

// Las respuestas conviven en dos formas: mapa (ingreso manual / Excel / foto) y
// arreglo (pantalla del participante). Un lector que solo entienda una devuelve
// vacío con la otra, y eso hacía que el autoguardado del participante borrara lo
// que el psicólogo había digitado a mano.
describe('toResponseList / toResponseMap: las dos formas de guardar respuestas', () => {
  const comoArreglo = [
    { questionNumber: 1, responseValue: 4, dimension: 'd', domain: 'x' },
    { questionNumber: 2, responseValue: 0 }
  ];
  const comoMapa = { '1': 4, '2': 0 };

  test('arreglo: se lee tal cual', () => {
    expect(toResponseMap(comoArreglo)).toEqual({ 1: 4, 2: 0 });
  });

  test('mapa: se lee igual de bien', () => {
    expect(toResponseMap(comoMapa)).toEqual({ 1: 4, 2: 0 });
  });

  test('las dos formas dan el mismo resultado', () => {
    expect(toResponseMap(comoArreglo)).toEqual(toResponseMap(comoMapa));
  });

  test('string JSON: se parsea', () => {
    expect(toResponseMap(JSON.stringify(comoMapa))).toEqual({ 1: 4, 2: 0 });
    expect(toResponseMap(JSON.stringify(comoArreglo))).toEqual({ 1: 4, 2: 0 });
  });

  // La columna es json y pg ya entrega un objeto: el JSON.parse de los lectores
  // viejos reventaba con "[object Object]" is not valid JSON y caía al catch.
  test('objeto ya parseado por pg: no revienta ni devuelve vacío', () => {
    expect(toResponseList(comoMapa)).toHaveLength(2);
  });

  test('el valor 0 no se pierde (es "Nunca", no ausencia)', () => {
    expect(toResponseMap({ '7': 0 })).toEqual({ 7: 0 });
  });

  test('valores de texto sobreviven (la ficha guarda strings)', () => {
    expect(toResponseMap({ '2': 'Masculino' })).toEqual({ 2: 'Masculino' });
  });

  test('entradas inválidas devuelven lista vacía, no explotan', () => {
    expect(toResponseList(null)).toEqual([]);
    expect(toResponseList(undefined)).toEqual([]);
    expect(toResponseList('no es json')).toEqual([]);
    expect(toResponseList({ 'abc': 1 })).toEqual([]);
  });
});
