// Firmas de Wompi. No toca la base: config/database se reemplaza por un stub
// para que el servicio cargue sin credenciales de Postgres.
// Stub de base que SI distingue el alcance de la consulta: `whereNull('user_id')`
// (tarifa de la instancia) de `where('user_id', id)` (acuerdo del evaluador).
// Con un stub que los confunde, la precedencia usuario > global > env —el
// corazon del cambio— pasaria los tests aunque estuviera al reves.
const mockRows = { tiersUser: [], tiersGlobal: [], system_configs: [] };
let mockFail = null;
jest.mock('../config/database', () => jest.fn((tabla) => {
  let esGlobal = null;
  const filas = () => {
    if (tabla !== 'pricing_tiers') return mockRows[tabla] || [];
    if (esGlobal === null) throw new Error('El stub exige filtrar pricing_tiers por user_id');
    return esGlobal ? mockRows.tiersGlobal : mockRows.tiersUser;
  };
  const qb = {
    select: () => qb,
    whereIn: () => qb,
    orderBy: () => qb,
    whereNull: (col) => { if (col === 'user_id') esGlobal = true; return qb; },
    where: (col) => { if (col === 'user_id') esGlobal = false; return qb; },
    then: (onOk, onErr) => (mockFail && tabla === 'pricing_tiers'
      ? Promise.reject(mockFail).then(onOk, onErr)
      : Promise.resolve(filas()).then(onOk, onErr)),
  };
  return qb;
}));

const crypto = require('crypto');
const wompi = require('../services/wompi');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Los fixtures de la tabla se limpian entre TODOS los tests: si solo se
// resetearan en el describe de precedencia, agregar un test alla arriba
// contaminaria los de retrocompatibilidad y la falla se leeria como
// "se rompio la compatibilidad" en vez de "se filtro un fixture".
beforeEach(() => {
  mockRows.tiersUser = [];
  mockRows.tiersGlobal = [];
  mockRows.system_configs = [];
  mockFail = null;
});

describe('Wompi: firma de integridad del checkout', () => {
  // Ejemplo de la documentacion oficial de Wompi (docs.wompi.co, "Firma de integridad").
  test('coincide con el ejemplo de la documentacion', () => {
    const sig = wompi.integritySignature('sk8-438k4-xmxm392-sn2m', 2490000, 'COP', 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6');
    expect(sig).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  test('con expiracion se incluye antes del secreto', () => {
    const sig = wompi.integritySignature('REF', 1000, 'COP', 'secret', '2023-06-09T20:28:50.000Z');
    expect(sig).toBe(sha256('REF1000COP2023-06-09T20:28:50.000Zsecret'));
  });

  test('la URL del checkout lleva monto, referencia, firma y redirect', () => {
    const url = new URL(wompi.buildCheckoutUrl({
      reference: 'BRS-1-X',
      amountInCents: 150000,
      redirectUrl: 'https://brs.test/evaluator/payments/result/',
      customerEmail: 'eval@test.com',
      key: 'pub_test_abc',
      secret: 'sec',
    }));
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    expect(url.searchParams.get('public-key')).toBe('pub_test_abc');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('amount-in-cents')).toBe('150000');
    expect(url.searchParams.get('reference')).toBe('BRS-1-X');
    expect(url.searchParams.get('signature:integrity')).toBe(sha256('BRS-1-X150000COPsec'));
    expect(url.searchParams.get('redirect-url')).toBe('https://brs.test/evaluator/payments/result/');
    expect(url.searchParams.get('customer-data:email')).toBe('eval@test.com');
  });

  test('el ambiente lo decide el prefijo de la llave publica', () => {
    expect(wompi.isSandbox('pub_test_xyz')).toBe(true);
    expect(wompi.isSandbox('pub_prod_xyz')).toBe(false);
    expect(wompi.apiBase('pub_test_xyz')).toBe('https://sandbox.wompi.co/v1');
    expect(wompi.apiBase('pub_prod_xyz')).toBe('https://production.wompi.co/v1');
  });
});

describe('Wompi: checksum de eventos', () => {
  // Ejemplo de la documentacion oficial de Wompi ("Eventos").
  const secret = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';
  const event = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: '1234-1610641025-49201',
        amount_in_cents: 4490000,
        reference: 'MZQ3X2DE2SMX',
        currency: 'COP',
        status: 'APPROVED',
      },
    },
    environment: 'prod',
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: sha256('1234-1610641025-49201APPROVED44900001530291411' + secret).toUpperCase(),
    },
    timestamp: 1530291411,
    sent_at: '2018-07-20T16:45:05.000Z',
  };

  test('acepta un evento bien firmado (hex en mayusculas o minusculas)', () => {
    expect(wompi.verifyEventChecksum(event, secret)).toBe(true);
    const lower = { ...event, signature: { ...event.signature, checksum: event.signature.checksum.toLowerCase() } };
    expect(wompi.verifyEventChecksum(lower, secret)).toBe(true);
  });

  test('rechaza si cambia el monto, el estado o el timestamp', () => {
    const tampered = JSON.parse(JSON.stringify(event));
    tampered.data.transaction.amount_in_cents = 1;
    expect(wompi.verifyEventChecksum(tampered, secret)).toBe(false);

    const tampered2 = JSON.parse(JSON.stringify(event));
    tampered2.data.transaction.status = 'DECLINED';
    expect(wompi.verifyEventChecksum(tampered2, secret)).toBe(false);

    expect(wompi.verifyEventChecksum({ ...event, timestamp: 1 }, secret)).toBe(false);
  });

  test('rechaza sin secreto, sin firma o con checksum malformado', () => {
    expect(wompi.verifyEventChecksum(event, '')).toBe(false);
    expect(wompi.verifyEventChecksum({ ...event, signature: undefined }, secret)).toBe(false);
    expect(wompi.verifyEventChecksum({ ...event, signature: { properties: [], checksum: 'zz' } }, secret)).toBe(false);
  });
});

describe('Wompi: tramos de tarifa', () => {
  // Los tramos acordados con una evaluadora concreta (noviembre 2026).
  const ESCALONADA = {
    tiers: [
      { minQty: 1, unitPriceCop: 5000 },
      { minQty: 50, unitPriceCop: 4500 },
      { minQty: 100, unitPriceCop: 4000 },
      { minQty: 250, unitPriceCop: 3500 },
    ],
  };

  test('cobra el tramo mas alto que la orden alcanza', () => {
    const p = (n) => wompi.unitPriceForQuantity(n, ESCALONADA);
    expect(p(1)).toBe(5000);
    expect(p(49)).toBe(5000);
    expect(p(50)).toBe(4500);   // "50 a 99": entra AL llegar, no al superar
    expect(p(99)).toBe(4500);
    expect(p(100)).toBe(4000);
    expect(p(249)).toBe(4000);
    expect(p(250)).toBe(3500);  // "250 o mas"
    expect(p(5000)).toBe(3500);
  });

  test('el precio del tramo aplica a toda la orden', () => {
    const total = (n) => n * wompi.unitPriceForQuantity(n, ESCALONADA);
    expect(total(49)).toBe(245000);
    expect(total(50)).toBe(225000);   // una prueba mas, $20.000 menos
    expect(total(100)).toBe(400000);
    expect(total(250)).toBe(875000);
  });

  test('cruzar un umbral ABARATA el total: el salto es real en los tres tramos', () => {
    // Comportamiento deliberado (el precio aplica a toda la orden), no un bug:
    // por eso la UI avisa cuando faltan pocas pruebas para el siguiente tramo.
    const total = (n) => n * wompi.unitPriceForQuantity(n, ESCALONADA);
    expect(total(49) - total(50)).toBe(20000);
    expect(total(99) - total(100)).toBe(45500);
    expect(total(249) - total(250)).toBe(121000);
  });

  describe('normalizeTiers', () => {
    test('ordena por cantidad aunque lleguen al reves', () => {
      expect(wompi.normalizeTiers([
        { minQty: 100, unitPriceCop: 4000 },
        { minQty: 1, unitPriceCop: 5000 },
      ])).toEqual([
        { minQty: 1, unitPriceCop: 5000 },
        { minQty: 100, unitPriceCop: 4000 },
      ]);
    });

    test('descarta un tramo que no baja el precio: cobraria mas por comprar mas', () => {
      expect(wompi.normalizeTiers([
        { minQty: 1, unitPriceCop: 5000 },
        { minQty: 50, unitPriceCop: 5000 },
        { minQty: 100, unitPriceCop: 6000 },
        { minQty: 200, unitPriceCop: 4000 },
      ])).toEqual([
        { minQty: 1, unitPriceCop: 5000 },
        { minQty: 200, unitPriceCop: 4000 },
      ]);
    });

    test('una tarifa que no arranca en 1 se descarta entera', () => {
      // Sin tramo inicial no hay precio para una orden chica, y una tarifa
      // con huecos no se puede cobrar.
      expect(wompi.normalizeTiers([{ minQty: 50, unitPriceCop: 4500 }])).toEqual([]);
    });

    test('descarta cantidades y precios invalidos', () => {
      expect(wompi.normalizeTiers([
        { minQty: 1, unitPriceCop: 5000 },
        { minQty: 0, unitPriceCop: 4000 },
        { minQty: 60, unitPriceCop: 0 },
        { minQty: 'x', unitPriceCop: 100 },
      ])).toEqual([{ minQty: 1, unitPriceCop: 5000 }]);
    });

    test('sin tramos no hay precio', () => {
      expect(wompi.normalizeTiers([])).toEqual([]);
      expect(wompi.unitPriceForQuantity(10, { tiers: [] })).toBe(0);
    });
  });

  // getPricing consulta `pricing_tiers`; con el stub de database la consulta
  // falla y cae a las env vars, que es el camino de compatibilidad que nos
  // interesa cubrir aqui.
  describe('compatibilidad con las env vars de siempre', () => {
    const ENV = { ...process.env };
    beforeEach(() => {
      process.env.BRS_TEST_PRICE_COP = '5000';
      process.env.BRS_TEST_PRICE_BULK_COP = '3500';
      process.env.BRS_TEST_BULK_MIN_QTY = '250';
    });
    afterEach(() => { process.env = { ...ENV }; });

    test('las dos env vars se leen como dos tramos', async () => {
      const p = await wompi.getPricing();
      expect(p.source).toBe('env');
      expect(p.unitPriceCop).toBe(5000);
      // El esquema viejo bajaba el precio al SUPERAR 250, no al alcanzarlo:
      // el tramo arranca en 251 para no cambiarle el cobro a nadie.
      expect(p.tiers).toEqual([
        { minQty: 1, unitPriceCop: 5000 },
        { minQty: 251, unitPriceCop: 3500 },
      ]);
      expect(wompi.unitPriceForQuantity(250, p)).toBe(5000);
      expect(wompi.unitPriceForQuantity(251, p)).toBe(3500);
    });

    test('un precio de volumen que no baja el precio se ignora', async () => {
      process.env.BRS_TEST_PRICE_BULK_COP = '5000';
      const p = await wompi.getPricing();
      expect(p.tiers).toEqual([{ minQty: 1, unitPriceCop: 5000 }]);
      expect(wompi.unitPriceForQuantity(9999, p)).toBe(5000);
    });

    test('sin precio base el modulo queda desactivado', async () => {
      delete process.env.BRS_TEST_PRICE_COP;
      const p = await wompi.getPricing();
      expect(p.tiers).toEqual([]);
      expect(p.unitPriceCop).toBe(0);
      expect(wompi.isConfigured(p.unitPriceCop)).toBe(false);
    });
  });
});

describe('Wompi: de donde sale la tarifa', () => {
  const ENV = { ...process.env };
  const ACUERDO = [
    { minQty: 1, unitPriceCop: 5000 },
    { minQty: 50, unitPriceCop: 4500 },
    { minQty: 100, unitPriceCop: 4000 },
    { minQty: 250, unitPriceCop: 3500 },
  ];
  const GLOBAL = [
    { minQty: 1, unitPriceCop: 5000 },
    { minQty: 251, unitPriceCop: 3500 },
  ];

  beforeEach(() => {
    process.env.BRS_TEST_PRICE_COP = '5000';
    process.env.BRS_TEST_PRICE_BULK_COP = '3500';
    process.env.BRS_TEST_BULK_MIN_QTY = '250';
  });
  afterEach(() => { process.env = { ...ENV }; });

  test('sin filas en la tabla, usa las env vars', async () => {
    const p = await wompi.getPricing(88);
    expect(p.source).toBe('env');
  });

  test('con solo tarifa de instancia, la usa', async () => {
    mockRows.tiersGlobal = GLOBAL;
    const p = await wompi.getPricing(88);
    expect(p.source).toBe('global');
    expect(p.tiers).toEqual(GLOBAL);
  });

  test('el acuerdo del evaluador le gana a la tarifa de instancia', async () => {
    // Las dos existen y dan precios distintos para 100 pruebas: si la
    // precedencia estuviera al reves, este test lo ve.
    mockRows.tiersUser = ACUERDO;
    mockRows.tiersGlobal = GLOBAL;
    const p = await wompi.getPricing(88);
    expect(p.source).toBe('user');
    expect(wompi.unitPriceForQuantity(100, p)).toBe(4000);
    expect(wompi.unitPriceForQuantity(100, { tiers: GLOBAL })).toBe(5000);
  });

  test('un evaluador sin acuerdo propio recibe la tarifa de instancia', async () => {
    mockRows.tiersGlobal = GLOBAL;
    const p = await wompi.getPricing(999);
    expect(p.source).toBe('global');
    expect(wompi.unitPriceForQuantity(100, p)).toBe(5000);
  });

  test('un acuerdo sin tramo base se descarta y cae a la tarifa de instancia', async () => {
    // Si se carga solo el tramo de volumen, la tarifa no cubre las ordenes
    // chicas: se descarta entera en vez de dejar al evaluador sin precio.
    mockRows.tiersUser = [{ minQty: 250, unitPriceCop: 3500 }];
    mockRows.tiersGlobal = GLOBAL;
    const p = await wompi.getPricing(88);
    expect(p.source).toBe('global');
    expect(wompi.unitPriceForQuantity(10, p)).toBe(5000);
  });

  test('si la tabla no existe todavia, cae a las env vars', async () => {
    mockFail = Object.assign(new Error('relation "pricing_tiers" does not exist'), { code: '42P01' });
    const p = await wompi.getPricing(88);
    expect(p.source).toBe('env');
    expect(p.unitPriceCop).toBe(5000);
  });

  test('cualquier OTRO fallo de base se propaga en vez de cobrar la tarifa cara', async () => {
    // Tragarselo cobraria la tarifa de la instancia a un evaluador con
    // descuento negociado, y esa orden quedaria indistinguible de una legitima.
    mockFail = Object.assign(new Error('too many connections'), { code: '53300' });
    await expect(wompi.getPricing(88)).rejects.toThrow('too many connections');
  });

  describe('aviso de tarifa mal cargada', () => {
    let spy;
    beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => spy.mockRestore());

    test('avisa una sola vez, no en cada request', async () => {
      mockRows.tiersUser = [{ minQty: 250, unitPriceCop: 3500 }];
      await wompi.getPricing(5001);
      await wompi.getPricing(5001);
      await wompi.getPricing(5001);
      const propios = spy.mock.calls.filter((c) => String(c[0]).includes('evaluador 5001'));
      expect(propios).toHaveLength(1);
      expect(propios[0][0]).toMatch(/se descarto entera/);
    });

    test('si el problema cambia, vuelve a avisar', async () => {
      mockRows.tiersUser = [{ minQty: 250, unitPriceCop: 3500 }];
      await wompi.getPricing(5002);
      // Ahora la tarifa arranca bien pero trae un tramo que no baja el precio:
      // es otro problema y tiene que reportarse, no quedar tapado por el anterior.
      mockRows.tiersUser = [{ minQty: 1, unitPriceCop: 5000 }, { minQty: 50, unitPriceCop: 6000 }];
      await wompi.getPricing(5002);
      const propios = spy.mock.calls.filter((c) => String(c[0]).includes('evaluador 5002'));
      expect(propios).toHaveLength(2);
      expect(propios[1][0]).toMatch(/se ignoraron 1 tramo/);
    });

    test('si el problema se arregla y vuelve, avisa otra vez', async () => {
      const roto = [{ minQty: 1, unitPriceCop: 5000 }, { minQty: 50, unitPriceCop: 6000 }];
      mockRows.tiersUser = roto;
      await wompi.getPricing(5004);
      mockRows.tiersUser = [{ minQty: 1, unitPriceCop: 5000 }, { minQty: 50, unitPriceCop: 4500 }];
      await wompi.getPricing(5004);          // sana: se olvida el aviso
      mockRows.tiersUser = roto;
      await wompi.getPricing(5004);          // reincide: tiene que volver a avisar
      expect(spy.mock.calls.filter((c) => String(c[0]).includes('evaluador 5004'))).toHaveLength(2);
    });

    test('una tarifa sana no avisa nada', async () => {
      mockRows.tiersUser = ACUERDO;
      await wompi.getPricing(5003);
      expect(spy.mock.calls.filter((c) => String(c[0]).includes('evaluador 5003'))).toHaveLength(0);
    });
  });
});
