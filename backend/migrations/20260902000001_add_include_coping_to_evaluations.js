/**
 * El Brief COPE deja de ser fijo: cada evaluación decide si lo aplica.
 *
 * El COPE-28 NO hace parte de la batería oficial del Ministerio (Resolución
 * 2646 de 2008); es un instrumento adicional que algunos clientes contratan y
 * otros no. Hasta ahora se le ofrecía a TODO participante de TODA instancia,
 * así que quien no lo había contratado igual veía 28 preguntas extra y su
 * informe podía traer una sección que nadie pidió.
 *
 * El default es `true` a propósito: las evaluaciones que ya existen vienen
 * aplicándolo y sus participantes pueden tener respuestas guardadas. Apagarlo
 * de golpe habría hecho desaparecer del informe datos ya recogidos.
 *
 * Apagar la bandera NO borra respuestas ni resultados: solo deja de ofrecer el
 * cuestionario y de imprimir su sección. Volver a encenderla los recupera.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.boolean('include_coping').notNullable().defaultTo(true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('evaluations', (table) => {
    table.dropColumn('include_coping');
  });
};
