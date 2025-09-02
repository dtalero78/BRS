/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('system_configs', function(table) {
    table.increments('id').primary();
    table.string('config_key', 100).unique().notNullable();
    table.text('config_value').nullable();
    table.string('description', 255).nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('system_configs');
};