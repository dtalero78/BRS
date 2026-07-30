/**
 * La verificación facial pasa de "una cada N horas" a "una por cuestionario".
 *
 * Con la regla por tiempo (ventana de 4h) la batería entera cabía dentro de una
 * sola ventana: el participante mostraba la cara una vez al principio y nunca
 * más, así que no se comprobaba continuidad alguna. Para exigirla por
 * cuestionario, la bitácora necesita saber a cuál corresponde cada intento —
 * si no, el guard de `POST /:token/responses` no puede distinguirlos y el
 * bloqueo se podría saltar con un POST directo.
 *
 * Las filas viejas quedan con questionnaire_type NULL y por lo tanto no
 * satisfacen a ningún cuestionario: los participantes que ya se habían
 * verificado bajo la regla anterior vuelven a verificarse. Es el lado seguro.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('face_verifications', function(table) {
    table.string('questionnaire_type', 32).nullable();
    table.index(
      ['participant_evaluation_id', 'questionnaire_type', 'verified'],
      'idx_face_verif_pe_questionnaire'
    );
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('face_verifications', function(table) {
    table.dropIndex(
      ['participant_evaluation_id', 'questionnaire_type', 'verified'],
      'idx_face_verif_pe_questionnaire'
    );
    table.dropColumn('questionnaire_type');
  });
};
