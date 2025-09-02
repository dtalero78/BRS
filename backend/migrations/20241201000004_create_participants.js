/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('participants', function(table) {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    table.string('email', 255).unique().notNullable();
    table.json('demographic_data').nullable();
    table.boolean('active').defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('participants');
};