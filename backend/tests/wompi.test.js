// Firmas de Wompi. No toca la base: config/database se reemplaza por un stub
// para que el servicio cargue sin credenciales de Postgres.
jest.mock('../config/database', () => jest.fn());
const crypto = require('crypto');
const wompi = require('../services/wompi');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

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
