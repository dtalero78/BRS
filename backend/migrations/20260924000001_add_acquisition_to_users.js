/**
 * Guarda de dónde llegó cada evaluador que se auto-registra.
 *
 * Por qué: la atribución de Google Ads no es confiable para este producto. El
 * 56% de las impresiones son móviles pero registrarse y crear una empresa es
 * trabajo de escritorio, así que el clic y el registro ocurren en dispositivos
 * distintos y la cadena de cookies se rompe. Además, entre el 2026-07-20 y el
 * 2026-08-27 el tag de GA4 estuvo roto (ver _app.tsx) y Ads no recibió NADA:
 * durante 20 días la campaña reportó 0 conversiones mientras la base sumaba 14
 * registros reales. Con esta columna la respuesta sale de nuestros propios
 * datos y no depende de que el puente GA4→Ads esté sano.
 *
 * Es JSONB y no una columna `gclid` suelta para poder guardar también los utm_*
 * y el referrer sin otra migración, y para que quepan canales que todavía no
 * usamos (Meta, LinkedIn) sin tocar el esquema.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('users', 'acquisition');
  if (exists) return;

  await knex.schema.alterTable('users', (table) => {
    table.jsonb('acquisition').nullable();
  });

  // Índice de expresión sobre gclid: la consulta que importa es "¿cuáles de
  // estos registros vinieron de Ads?", y sin índice escanea toda la tabla.
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS idx_users_acquisition_gclid " +
    "ON users ((acquisition->>'gclid')) WHERE acquisition->>'gclid' IS NOT NULL"
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_users_acquisition_gclid');
  const exists = await knex.schema.hasColumn('users', 'acquisition');
  if (!exists) return;
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('acquisition');
  });
};
