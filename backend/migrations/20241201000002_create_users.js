/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.enu('role', ['admin', 'evaluator', 'participant']).notNullable();
    table.integer('company_id').unsigned().nullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('users');
};