/**
 * Add a JSONB column to store per-evaluation overrides for the editable prose
 * sections of the organizational PDF report (introducción, objetivos,
 * metodología, procedimientos, recomendaciones, conclusiones). Null means
 * "use the computed defaults".
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.jsonb('report_text_overrides').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.dropColumn('report_text_overrides');
  });
};
