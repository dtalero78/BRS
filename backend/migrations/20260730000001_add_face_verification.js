/**
 * Verificación facial del participante en el link público (`/participant/evaluation/:token`).
 *
 * Modelo (portado de BODYTECH-PREPAGADAS, donde la referencia vive en el
 * profesional): aquí la referencia se guarda en `participant_evaluations`, no en
 * `participants`. La unidad de auditoría es la batería: si el mismo trabajador
 * vuelve a evaluarse el año siguiente, se enrola de nuevo con su cara actual en
 * vez de compararse contra una foto vieja.
 *
 * - face_reference_photo — selfie de referencia (data URL base64), auto-enrolada
 *   en el primer ingreso tras pasar el gate de calidad de DetectFaces.
 * - face_verifications — bitácora de cada intento. Con verificación BLOQUEANTE
 *   es la evidencia de por qué a alguien no se le dejó responder, y la fuente
 *   para calibrar el umbral.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.text('face_reference_photo').nullable();
    table.timestamp('face_reference_at').nullable();
  });

  await knex.schema.createTable('face_verifications', function(table) {
    table.increments('id').primary();
    table
      .integer('participant_evaluation_id')
      .notNullable()
      .references('id')
      .inTable('participant_evaluations')
      .onDelete('CASCADE');
    table.string('mode', 10).notNullable();          // 'enroll' | 'verify'
    table.boolean('verified').notNullable().defaultTo(false);
    table.decimal('score', 5, 2).nullable();         // similitud CompareFaces (0..100)
    table.text('issues').nullable();                 // problemas de calidad, si hubo
    // Solo se guarda la selfie de los intentos que NO pasaron (y la del enrolamiento):
    // es la evidencia útil. Guardar todas las exitosas engordaría la tabla sin aportar.
    table.text('captured_photo').nullable();
    table.string('ip', 64).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['participant_evaluation_id', 'created_at'], 'idx_face_verif_pe');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('face_verifications');
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.dropColumn('face_reference_photo');
    table.dropColumn('face_reference_at');
  });
};
