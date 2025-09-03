/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_questionnaire_type_check;
    ALTER TABLE responses ADD CONSTRAINT responses_questionnaire_type_check 
    CHECK (questionnaire_type IN ('ficha_datos', 'intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres'));
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_questionnaire_type_check;
    ALTER TABLE responses ADD CONSTRAINT responses_questionnaire_type_check 
    CHECK (questionnaire_type IN ('intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres'));
  `);
};
