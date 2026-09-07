const { fusionarFicha } = require('../utils/ficha-merge');

// Mapa en la numeración de la hoja OCR (FICHA_FIELDS): 1 fecha, 2 sexo,
// 3 año, 4 estudios, 5 estado civil, 6 ocupación, 7 ciudad residencia...
const soloEstudios = {
  '1': '', '2': '', '3': '', '4': 'Técnico/tecnológico incompleto', '5': '', '6': '',
  '7': '', '8': '', '9': '', '10': '', '11': '', '12': '', '13': '', '14': '',
  '15': '', '16': '', '17': '', '18': ''
};

const fichaPhotoCompleta = {
  '1': '24/08/2026', '2': 'Masculino', '3': '1983', '4': 'Bachillerato completo',
  '5': 'Casado(a)', '6': 'Técnico Colorista', '7': 'Soledad, Atlántico', '8': '2',
  '9': '3', '10': 'Familiar', '11': 'Barranquilla, Atlántico', '12': '3 años',
  '13': 'Colorista', '14': 'Auxiliar/asistente', '15': '2 años', '16': 'Producción',
  '17': 'Término indefinido', '18': '8'
};

describe('fusionarFicha: un import parcial no puede borrar datos ya diligenciados', () => {
  test('sin ficha previa, se guarda el mapa nuevo tal cual', () => {
    expect(fusionarFicha(null, soloEstudios)).toEqual(soloEstudios);
  });

  test('el OCR solo leyó estudios: se conserva todo lo demás', () => {
    const out = fusionarFicha(fichaPhotoCompleta, soloEstudios);
    expect(out['4']).toBe('Técnico/tecnológico incompleto'); // gana el dato nuevo
    expect(out['2']).toBe('Masculino');                      // se conserva
    expect(out['13']).toBe('Colorista');
    expect(out['17']).toBe('Término indefinido');
    const vacios = Object.values(out).filter(v => v === '').length;
    expect(vacios).toBe(0);
  });

  test('el dato nuevo siempre manda sobre el viejo', () => {
    const correccion = { ...soloEstudios, '13': 'Coordinador de Producción' };
    const out = fusionarFicha(fichaPhotoCompleta, correccion);
    expect(out['13']).toBe('Coordinador de Producción');
  });

  // El caso que corrompería los datos si el merge fuera por número de pregunta:
  // en 'official' la 5 es la ocupación y la 19 el estado civil; en la hoja OCR
  // la 5 es el estado civil y la 6 la ocupación.
  test('ficha guardada en numeración official: el merge respeta el significado', () => {
    const fichaOfficial = [
      { questionNumber: 1, responseValue: 'Jairo Rubiano' },
      { questionNumber: 2, responseValue: 'Masculino' },
      { questionNumber: 3, responseValue: 1987 },
      { questionNumber: 4, responseValue: 'Profesional completo' },
      { questionNumber: 5, responseValue: 'Ingeniero de Sistemas' },  // ocupación
      { questionNumber: 6, responseValue: 'Bogotá' },                 // ciudad residencia
      { questionNumber: 13, responseValue: 'Profesional' },           // tipoCargo
      { questionNumber: 19, responseValue: 'Soltero(a)' }             // estado civil
    ];
    const out = fusionarFicha(fichaOfficial, soloEstudios);
    expect(out['1']).toBe('Jairo Rubiano');        // nombre, solo existe en official
    expect(out['4']).toBe('Técnico/tecnológico incompleto');
    expect(out['5']).toBe('Ingeniero de Sistemas'); // sigue siendo la ocupación
    expect(out['19']).toBe('Soltero(a)');           // sigue siendo el estado civil
  });

  test('un valor nuevo se reubica al número que le toca en official', () => {
    const fichaOfficial = [
      { questionNumber: 1, responseValue: 'Jairo Rubiano' },
      { questionNumber: 13, responseValue: 'Profesional' }
    ];
    // en la hoja OCR el 5 es estado civil; en official debe caer en el 19
    const nuevo = { ...soloEstudios, '5': 'Casado(a)', '6': 'Ingeniero' };
    const out = fusionarFicha(fichaOfficial, nuevo);
    expect(out['19']).toBe('Casado(a)');
    expect(out['5']).toBe('Ingeniero');
  });
});
