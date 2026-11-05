/**
 * Carga los tramos de tarifa de un evaluador (o los de la instancia).
 *
 *   node scripts/set-pricing-tiers.js --user rpauladaniela@gmail.com 1:5000 50:4500 100:4000 250:3500
 *   node scripts/set-pricing-tiers.js --global 1:5000 251:3500
 *   node scripts/set-pricing-tiers.js --user alguien@correo.com --borrar
 *
 * Cada tramo es `desdeCuantasPruebas:precioPorPrueba`, y el precio aplica a
 * TODA la orden que alcance esa cantidad.
 *
 * Por defecto solo MUESTRA lo que haria. Hay que agregar --apply para escribir.
 */
const path = require('path');
const B = path.resolve(__dirname, '..');
require(path.join(B, 'node_modules/dotenv')).config({ path: path.join(B, '.env') });
const db = require(path.join(B, 'config/database'));
const { normalizeTiers } = require(path.join(B, 'services/wompi'));

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const borrar = argv.includes('--borrar');
const global_ = argv.includes('--global');
const emailIdx = argv.indexOf('--user');
const email = emailIdx >= 0 ? argv[emailIdx + 1] : null;

const tiers = argv
  .filter((a) => /^\d+:\d+$/.test(a))
  .map((a) => {
    const [minQty, unitPriceCop] = a.split(':').map(Number);
    return { minQty, unitPriceCop };
  });

const cop = (n) => '$' + Number(n).toLocaleString('es-CO');

(async () => {
  if (!email && !global_) throw new Error('Falta --user <email> o --global');
  if (!borrar && !tiers.length) throw new Error('No diste ningun tramo (formato: 50:4500)');

  if (!(await db.schema.hasTable('pricing_tiers'))) {
    throw new Error('La tabla pricing_tiers no existe en esta base. Falta desplegar la migracion.');
  }

  let userId = null;
  if (email) {
    const u = await db('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
    if (!u) throw new Error(`No existe un usuario con ${email}`);
    if (u.role !== 'evaluator' && u.role !== 'admin') throw new Error(`${email} es ${u.role}, no paga pruebas`);
    userId = u.id;
    console.log(`Evaluador: ${u.full_name || '(sin nombre)'} <${u.email}>  id=${u.id}`);
  } else {
    console.log('Tarifa de la INSTANCIA (aplica a todo evaluador sin acuerdo propio)');
  }

  const actuales = await db('pricing_tiers')
    .where(userId == null ? db.raw('user_id IS NULL') : { user_id: userId })
    .orderBy('min_qty');
  console.log(`\nTramos actuales: ${actuales.length ? '' : '(ninguno)'}`);
  actuales.forEach((t) => console.log(`   desde ${String(t.min_qty).padStart(4)} → ${cop(t.unit_price_cop)}`));

  if (borrar) {
    console.log('\nSe BORRARAN todos esos tramos.');
  } else {
    // Mismas reglas que el calculo real: si aqui se descarta algo, en
    // produccion tambien se descartaria y el precio no seria el que crees.
    const limpios = normalizeTiers(tiers);
    if (limpios.length !== tiers.length) {
      throw new Error('Tramos invalidos: deben arrancar en 1 y cada uno debe costar MENOS que el anterior.');
    }
    console.log('\nTramos nuevos:');
    limpios.forEach((t, i) => {
      const hasta = limpios[i + 1] ? limpios[i + 1].minQty - 1 : null;
      const rango = hasta ? `${t.minQty} a ${hasta}` : `${t.minQty} o mas`;
      console.log(`   ${rango.padEnd(12)} → ${cop(t.unitPriceCop)} c/u`);
    });
    console.log('\nTotal de ejemplo:');
    [1, 49, 50, 99, 100, 249, 250, 500].forEach((n) => {
      let precio = limpios[0].unitPriceCop;
      limpios.forEach((t) => { if (n >= t.minQty) precio = t.unitPriceCop; });
      console.log(`   ${String(n).padStart(4)} pruebas → ${cop(n * precio).padStart(12)}`);
    });
  }

  if (!apply) {
    console.log('\n(simulacion — agrega --apply para escribir)');
    process.exit(0);
  }

  await db.transaction(async (trx) => {
    const q = trx('pricing_tiers');
    if (userId == null) q.whereNull('user_id'); else q.where('user_id', userId);
    await q.del();
    if (!borrar) {
      await trx('pricing_tiers').insert(tiers.map((t) => ({
        user_id: userId,
        min_qty: t.minQty,
        unit_price_cop: t.unitPriceCop,
        note: email ? `Acuerdo con ${email}` : 'Tarifa de la instancia',
      })));
    }
  });

  console.log('\n✅ Aplicado.');
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
