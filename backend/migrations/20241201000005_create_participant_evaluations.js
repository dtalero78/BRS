/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('participant_evaluations', function(table) {
    table.increments('id').primary();
    table.integer('evaluation_id').unsigned().notNullable();
    table.foreign('evaluation_id').references('evaluations.id').onDelete('CASCADE');
    table.integer('participant_id').unsigned().notNullable();
    table.foreign('participant_id').references('participants.id').onDelete('CASCADE');
    table.enu('status', ['assigned', 'in_progress', 'completed']).defaultTo('assigned');
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['evaluation_id', 'participant_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('participant_evaluations');
};