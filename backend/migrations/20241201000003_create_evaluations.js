/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('evaluations', function(table) {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.date('start_date');
    table.date('end_date');
    table.enu('status', ['draft', 'active', 'completed', 'archived']).defaultTo('draft');
    table.integer('created_by').unsigned().notNullable();
    table.foreign('created_by').references('users.id');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('evaluations');
};