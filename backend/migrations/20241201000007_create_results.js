/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('results', function(table) {
    table.increments('id').primary();
    table.integer('participant_evaluation_id').unsigned().notNullable();
    table.foreign('participant_evaluation_id').references('participant_evaluations.id').onDelete('CASCADE');
    table.enu('questionnaire_type', ['intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres']).notNullable();
    table.json('results').notNullable();
    table.timestamp('calculated_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.unique(['participant_evaluation_id', 'questionnaire_type']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('results');
};