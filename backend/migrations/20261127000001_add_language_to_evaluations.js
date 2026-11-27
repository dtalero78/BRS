/**
 * Idioma de la evaluación: qué idioma ve el participante.
 *
 * Lo decide el evaluador por evaluación (no el participante con un botón):
 * así un mismo grupo no queda respondido en dos idiomas distintos dentro de un
 * mismo informe.
 *
 * El idioma cambia SOLO lo que se muestra. Lo que se guarda es idéntico en los
 * dos: las escalas se guardan como número (0-4 / 0-3) y las opciones de la
 * ficha se guardan con su literal oficial en español, aunque la persona haya
 * visto la etiqueta en inglés. Por eso el motor de cálculo, los informes y las
 * agrupaciones demográficas no necesitan saber en qué idioma se respondió.
 *
 * Default 'es': toda evaluación existente sigue exactamente igual.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('evaluations', (table) => {
    table.string('language', 5).notNullable().defaultTo('es');
  });
  await knex.raw(
    "ALTER TABLE evaluations ADD CONSTRAINT evaluations_language_check CHECK (language IN ('es', 'en'))"
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function(knex) {
  await knex.raw('ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_language_check');
  await knex.schema.alterTable('evaluations', (table) => {
    table.dropColumn('language');
  });
};
