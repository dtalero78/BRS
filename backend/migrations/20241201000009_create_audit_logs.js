/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable();
    table.foreign('user_id').references('users.id').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('table_name', 100).notNullable();
    table.integer('record_id').unsigned().nullable();
    table.json('old_values').nullable();
    table.json('new_values').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};