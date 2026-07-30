/**
 * Permite `coping` en las CHECK constraints de `responses` y `results`.
 *
 * Deriva de esquema: el Brief COPE se agregó a la app pero la constraint solo
 * se amplió A MANO en la base de BRS principal. Cualquier base creada desde las
 * migraciones (brs_shaddai, y cualquier licenciatario nuevo) se quedó con la
 * lista vieja, así que un participante que completaba el Brief COPE recibía un
 * 500 al guardar y perdía sus 28 respuestas — el frontend sí le ofrecía el
 * cuestionario.
 *
 * Se hace drop + add con la lista completa: es idempotente y deja iguales tanto
 * las bases parcheadas a mano como las que nunca lo estuvieron.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
const TIPOS = ['ficha_datos', 'intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres', 'coping'];
const LISTA = TIPOS.map(t => `'${t}'`).join(', ');

exports.up = async function(knex) {
  for (const tabla of ['responses', 'results']) {
    await knex.raw(`ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS ${tabla}_questionnaire_type_check`);
    await knex.raw(
      `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_questionnaire_type_check
       CHECK (questionnaire_type IN (${LISTA}))`
    );
  }
};

/**
 * Vuelve a la lista sin `coping`. Solo es seguro si no hay filas de coping;
 * si las hay, el ALTER falla — que es lo correcto: revertir borraría la
 * validez de datos ya guardados.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const sinCoping = TIPOS.filter(t => t !== 'coping').map(t => `'${t}'`).join(', ');
  for (const tabla of ['responses', 'results']) {
    await knex.raw(`ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS ${tabla}_questionnaire_type_check`);
    await knex.raw(
      `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_questionnaire_type_check
       CHECK (questionnaire_type IN (${sinCoping}))`
    );
  }
};
