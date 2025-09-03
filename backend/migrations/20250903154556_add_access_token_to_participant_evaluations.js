/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('participant_evaluations', function(table) {
    table.string('access_token', 64).unique();
    table.timestamp('token_expires_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('participant_evaluations', function(table) {
    table.dropColumn('access_token');
    table.dropColumn('token_expires_at');
  });
};