/**
 * Add payment tracking columns to evaluations.
 * Used to gate PDF report downloads behind admin-marked payment.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.boolean('paid').notNullable().defaultTo(false);
    table.timestamp('paid_at').nullable();
    table.integer('paid_by').nullable().references('id').inTable('users').onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.dropColumn('paid_by');
    table.dropColumn('paid_at');
    table.dropColumn('paid');
  });
};
