/**
 * Socialización en video antes de la batería (opt-in por instancia vía
 * SOCIALIZATION_VIDEO, ver `backend/config/socialization.js`).
 *
 * - socialization_watched_seconds: hasta dónde vio el video, validado contra el
 *   reloj del servidor (no se puede reportar más de lo que alcanzó a pasar).
 *   Permite retomar donde quedó si cierra la página a mitad.
 * - socialization_reported_at: último reporte de avance; es la base de esa
 *   validación.
 * - socialization_completed_at: lo vio completo. Es el registro que pide la
 *   socialización y la condición del guard de POST /:token/responses.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('participant_evaluations', (t) => {
    t.decimal('socialization_watched_seconds', 8, 2).notNullable().defaultTo(0);
    t.timestamp('socialization_reported_at', { useTz: true }).nullable();
    t.timestamp('socialization_completed_at', { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('participant_evaluations', (t) => {
    t.dropColumn('socialization_watched_seconds');
    t.dropColumn('socialization_reported_at');
    t.dropColumn('socialization_completed_at');
  });
};
