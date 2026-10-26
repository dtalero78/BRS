/**
 * SOFI-SM (fatiga laboral) como cuestionario opcional por evaluación.
 *
 * Igual que el Brief COPE, no hace parte de la batería oficial: es el
 * instrumento adicional que se le vendió a Shaddai en el contrato de licencia.
 *
 * 1. `sofi` entra a las CHECK de `responses` y `results`. Se hace aquí, en la
 *    migración, y no a mano: con el COPE la constraint solo se amplió en la
 *    base principal y todas las bases nuevas perdían las respuestas con un 500
 *    (ver 20260731000002).
 * 2. `evaluations.include_sofi`, default `false`. Al revés que `include_coping`:
 *    ahí el default `true` protegía datos ya recogidos; aquí no hay ninguno, y
 *    encenderlo por defecto le pondría 18 preguntas extra a toda campaña.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
const TIPOS = ['ficha_datos', 'intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres', 'coping', 'sofi'];

async function setTipos(knex, tipos) {
  const lista = tipos.map(t => `'${t}'`).join(', ');
  for (const tabla of ['responses', 'results']) {
    await knex.raw(`ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS ${tabla}_questionnaire_type_check`);
    await knex.raw(
      `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_questionnaire_type_check
       CHECK (questionnaire_type IN (${lista}))`
    );
  }
}

exports.up = async function(knex) {
  await setTipos(knex, TIPOS);
  await knex.schema.alterTable('evaluations', (table) => {
    table.boolean('include_sofi').notNullable().defaultTo(false);
  });
};

/**
 * Si ya hay filas de `sofi`, el ALTER de la CHECK falla — que es lo correcto:
 * revertir dejaría inválidos datos ya guardados.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('evaluations', (table) => {
    table.dropColumn('include_sofi');
  });
  await setTipos(knex, TIPOS.filter(t => t !== 'sofi'));
};
