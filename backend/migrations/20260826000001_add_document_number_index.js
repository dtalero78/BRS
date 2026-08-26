/**
 * Índice para la puerta general de acceso (`POST /api/participant-access/lookup`),
 * donde la persona entra escribiendo su número de documento.
 *
 * El documento no vive en una columna propia sino dentro del JSON de
 * `demographic_data`, así que la búsqueda es por expresión. Sin este índice
 * cada intento de ingreso hace un escaneo secuencial de toda la tabla de
 * participantes — y con el enlace general la empresa entera entra a la vez.
 *
 * `->>` es IMMUTABLE tanto en `json` como en `jsonb`, así que el índice de
 * expresión es válido sin importar cuál de los dos tenga la instancia (el
 * esquema de este proyecto tiene deriva entre la base hecha a mano y la que
 * producen las migraciones).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_participants_document_number
    ON participants ((demographic_data->>'documentNumber'))
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_participants_document_number');
};
