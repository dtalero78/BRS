/**
 * Celular del evaluador, pedido en el auto-registro.
 *
 * Nullable: los evaluadores registrados antes de este cambio no lo tienen, y
 * los usuarios creados por el admin tampoco lo piden. El registro sí lo exige.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('users', 'phone');
  if (exists) return;

  await knex.schema.alterTable('users', (table) => {
    table.string('phone', 20).nullable();
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasColumn('users', 'phone');
  if (!exists) return;
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('phone');
  });
};
