/**
 * Replace the global unique constraint on participants.email with a
 * composite unique constraint on (company_id, email). The synthetic
 * cc_<documento>@temp.com emails minted by the Excel importer must be
 * unique only within a single company, not across the whole DB —
 * otherwise two companies importing the same documento collide.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('participants', (table) => {
    table.dropUnique('email');                  // drops constraint participants_email_unique
    table.unique(['company_id', 'email']);      // creates participants_company_id_email_unique
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('participants', (table) => {
    table.dropUnique(['company_id', 'email']);
    table.unique('email');
  });
};
