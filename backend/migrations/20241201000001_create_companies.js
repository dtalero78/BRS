/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('companies', function(table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('nit', 50).unique().notNullable();
    table.string('contact_email', 255);
    table.string('contact_phone', 20);
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('companies');
};