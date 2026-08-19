/**
 * Consentimiento informado del participante.
 *
 * Exigencia legal de la Resolución 2646 de 2008 y la Ley 1090 de 2006 para
 * aplicar la batería, y de la Ley 1581 de 2012 para tratar datos personales.
 * En las instancias con verificación facial es todavía más exigible: la foto
 * del rostro es dato biométrico, que el art. 5 de la 1581 clasifica como
 * SENSIBLE y por lo tanto requiere autorización previa, expresa e informada.
 *
 * En `participant_evaluations`:
 *  - consent_accepted_at / consent_declined_at — solo una de las dos tiene
 *    valor a la vez; aceptar después de rechazar limpia el rechazo (la persona
 *    puede cambiar de opinión, y el consentimiento libre lo permite).
 *  - consent_ip — desde dónde se aceptó.
 *  - consent_text — SNAPSHOT del texto exacto que se le mostró. Sin esto no se
 *    puede probar QUÉ aceptó: el evaluador puede editar el texto de la
 *    evaluación después, y entonces el consentimiento guardado dejaría de
 *    corresponder a lo que la persona leyó.
 *
 * En `evaluations`:
 *  - consent_text_override — texto propio del evaluador. NULL = usar el
 *    default que arma `backend/utils/consent-template.js`.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.timestamp('consent_accepted_at').nullable();
    table.timestamp('consent_declined_at').nullable();
    table.string('consent_ip', 64).nullable();
    table.text('consent_text').nullable();
  });

  await knex.schema.alterTable('evaluations', function(table) {
    table.text('consent_text_override').nullable();
  });

  // Para que el evaluador filtre rápido "quién rechazó" sin escanear la tabla.
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_pe_consent_declined
    ON participant_evaluations (consent_declined_at)
    WHERE consent_declined_at IS NOT NULL
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_pe_consent_declined');
  await knex.schema.alterTable('evaluations', function(table) {
    table.dropColumn('consent_text_override');
  });
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.dropColumn('consent_accepted_at');
    table.dropColumn('consent_declined_at');
    table.dropColumn('consent_ip');
    table.dropColumn('consent_text');
  });
};
