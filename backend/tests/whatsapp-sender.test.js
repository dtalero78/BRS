const { normalizarCelular } = require('../services/whatsapp-sender');

// Casos reales de VATCO GROUP (brs_shaddai, empresa 35) reportados el
// 2026-10-16: 44 invitaciones marcadas "Celular invalido" en el envio
// masivo. La mayoria traia DOS numeros separados por "-" o "-" (guion
// largo), no por "/", que era el unico separador que se reconocia.
describe('normalizarCelular: casos reales de VATCO (envio masivo con errores)', () => {
  test('separador guion, con espacios', () => {
    expect(normalizarCelular('3232028522 - 3105734290')).toBe('+573232028522');
    expect(normalizarCelular('3216728488 - 3003468463')).toBe('+573216728488');
    expect(normalizarCelular('3054618014 - 3197121532')).toBe('+573054618014');
    expect(normalizarCelular('3194013720 - 3155869911')).toBe('+573194013720');
    expect(normalizarCelular('3183338120 - 3215746510')).toBe('+573183338120');
  });

  test('separador guion, sin espacios', () => {
    expect(normalizarCelular('3162532288-3118817788')).toBe('+573162532288');
  });

  test('separador guion sin espacio antes, con espacio raro dentro del segundo numero', () => {
    expect(normalizarCelular('3246875767- 312 8180136')).toBe('+573246875767');
  });

  test('separador guion largo (en-dash, copiado de Excel/Word)', () => {
    expect(normalizarCelular('3218634842 – 3127617368')).toBe('+573218634842');
  });

  test('basura de OCR entre los dos numeros (pipe)', () => {
    expect(normalizarCelular('3004608716 - 318|6783236')).toBe('+573004608716');
  });

  test('campo vacio sigue siendo invalido (no hay nada que rescatar)', () => {
    expect(normalizarCelular('')).toBeNull();
    expect(normalizarCelular(null)).toBeNull();
    expect(normalizarCelular(undefined)).toBeNull();
  });
});

// Los formatos documentados de un solo numero no se pueden romper al
// agregar el manejo de dos numeros.
describe('normalizarCelular: un solo numero (formatos ya soportados)', () => {
  test('diez digitos limpios', () => {
    expect(normalizarCelular('3001234567')).toBe('+573001234567');
  });
  test('con espacios internos', () => {
    expect(normalizarCelular('300 123 4567')).toBe('+573001234567');
  });
  test('con prefijo de pais pegado', () => {
    expect(normalizarCelular('573001234567')).toBe('+573001234567');
  });
  test('con prefijo de pais y mas, "+57 300 1234567"', () => {
    expect(normalizarCelular('+57 300 1234567')).toBe('+573001234567');
  });
  test('separador "/", el caso que ya funcionaba', () => {
    expect(normalizarCelular('3103834912 / 3142836810')).toBe('+573103834912');
  });
});

describe('normalizarCelular: sigue rechazando lo que de verdad no es un movil colombiano', () => {
  test('numero fijo (no empieza en 3)', () => {
    expect(normalizarCelular('6012345678')).toBeNull();
  });
  test('muy corto', () => {
    expect(normalizarCelular('30012345')).toBeNull();
  });
  test('texto sin digitos', () => {
    expect(normalizarCelular('sin numero')).toBeNull();
  });
  test('dos numeros, ninguno valido', () => {
    expect(normalizarCelular('12345 - 67890')).toBeNull();
  });
});
