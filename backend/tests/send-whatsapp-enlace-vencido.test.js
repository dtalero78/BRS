// Alliance Risk (shaddai, nov-2026): 1.034 de 1.160 enlaces vencidos y el envío
// masivo se detenía con "regeneralo antes de enviar", sin botón para hacerlo.
const filas = [];
const updates = [];
const enviados = [];

jest.mock('../middleware/auth', () => ({
  auth: (req, res, next) => { req.user = { userId: 41, role: 'evaluator' }; next(); },
  authorize: () => (req, res, next) => next(),
  getOwnedCompanyIds: async () => [1],
  isSuperAdmin: () => false,
}));
jest.mock('../services/whatsapp-sender', () => ({
  isConfigured: () => true,
  enviarInvitacion: async ({ token }) => { enviados.push(token); return { ok: true, sid: 'SM1' }; },
}));
jest.mock('../config/database', () => {
  const db = (table) => {
    const q = { table, wheres: {} };
    const chain = {
      join() { return chain; }, leftJoin() { return chain; }, whereIn() { return chain; },
      select() { return chain; },
      where(a, b) { if (typeof a === 'object') Object.assign(q.wheres, a); else q.wheres[a] = b; return chain; },
      update(data) { updates.push({ wheres: { ...q.wheres }, data }); return Promise.resolve(1); },
      then(res, rej) { return Promise.resolve(filas).then(res, rej); },
    };
    return chain;
  };
  return db;
});

const express = require('express');
const request = require('supertest');
const router = require('../routes/participants');
const app = express().use(express.json()).use('/', router);

const ayer = new Date(Date.now() - 86400000);
const enUnMes = new Date(Date.now() + 30 * 86400000);

beforeEach(() => { filas.length = 0; updates.length = 0; enviados.length = 0; });

test('enlace vencido: se corre la fecha 90 días, mismo token, y se envía', async () => {
  filas.push({ pe_id: 7, participant_id: 5, evaluation_id: 1, access_token: 'tok-viejo', token_expires_at: ayer,
    demographic_data: { firstName: 'Ana', phone: '3001234567' }, company_name: 'X' });
  const r = await request(app).post('/send-whatsapp').send({ items: [{ participantId: 5, evaluationId: 1 }] });
  expect(r.status).toBe(200);
  expect(enviados).toEqual(['tok-viejo']);
  const u = updates.find(x => x.data.token_expires_at);
  expect(u.wheres).toEqual({ id: 7 });
  const dias = (u.data.token_expires_at - Date.now()) / 86400000;
  expect(dias).toBeGreaterThan(89.9);
  expect(dias).toBeLessThan(90.1);
});

test('enlace vigente: no se toca la fecha', async () => {
  filas.push({ pe_id: 7, participant_id: 5, evaluation_id: 1, access_token: 'tok', token_expires_at: enUnMes,
    demographic_data: { firstName: 'Ana', phone: '3001234567' }, company_name: 'X' });
  await request(app).post('/send-whatsapp').send({ items: [{ participantId: 5, evaluationId: 1 }] });
  expect(updates.filter(x => x.data.token_expires_at)).toEqual([]);
  expect(enviados).toEqual(['tok']);
});

test('persona en dos evaluaciones: sale el enlace de la evaluación pedida', async () => {
  filas.push(
    { pe_id: 7, participant_id: 5, evaluation_id: 1, access_token: 'tok-eval-1', token_expires_at: enUnMes, demographic_data: { phone: '3001234567' } },
    { pe_id: 8, participant_id: 5, evaluation_id: 2, access_token: 'tok-eval-2', token_expires_at: enUnMes, demographic_data: { phone: '3001234567' } },
  );
  await request(app).post('/send-whatsapp').send({ items: [{ participantId: 5, evaluationId: 1 }] });
  expect(enviados).toEqual(['tok-eval-1']);
});
