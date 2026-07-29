/**
 * `companies.created_by` es la columna sobre la que se apoya todo el modelo
 * de ownership (getOwnedCompanyIds), pero nunca se migró: se agregó a mano
 * en la BD de producción. Cualquier instancia nueva construida solo con
 * migraciones nace sin ella y revienta con 500 en el login.
 *
 * Idempotente a propósito: en producción la columna YA existe y esta
 * migración se va a ejecutar allí igual (no está en su knex_migrations).
 * Si intentara crearla sin verificar, el arranque fallaría y DigitalOcean
 * haría rollback del deploy.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('companies', 'created_by');
  if (exists) return;

  await knex.schema.alterTable('companies', function (table) {
    table.integer('created_by').unsigned().nullable();
    table.foreign('created_by').references('users.id').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasColumn('companies', 'created_by');
  if (!exists) return;

  await knex.schema.alterTable('companies', function (table) {
    table.dropColumn('created_by');
  });
};
