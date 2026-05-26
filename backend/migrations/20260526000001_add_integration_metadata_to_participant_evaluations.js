/**
 * Agrega columna integration_metadata a participant_evaluations para guardar
 * datos de origen cuando el participante es provisionado por una integración
 * externa (ej. BSL-PLATAFORMA2 / Platzi).
 *
 * Schema esperado:
 * {
 *   source: 'BSL',
 *   externalRef: 'orden-id-de-bsl',
 *   callbackUrl: 'https://bsl-plataforma.com/api/brs/webhook',
 *   returnUrl: 'https://bsl-plataforma.com/consulta-orden.html?ordenId=...'
 * }
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.jsonb('integration_metadata').nullable();
    table.index(['integration_metadata'], 'idx_pe_integration_metadata', 'gin');
  });
  // UNIQUE parcial sobre externalRef: garantiza idempotencia atómica al
  // crear participantes vía integración. Sin esto, dos POSTs concurrentes
  // con mismo externalRef podrían crear dos PEs antes de que ninguno vea
  // al otro. El WHERE excluye filas legacy donde integration_metadata es NULL.
  await knex.raw(`
    CREATE UNIQUE INDEX uniq_pe_external_ref
    ON participant_evaluations ((integration_metadata->>'externalRef'))
    WHERE integration_metadata->>'externalRef' IS NOT NULL
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS uniq_pe_external_ref');
  await knex.schema.alterTable('participant_evaluations', function(table) {
    table.dropIndex(['integration_metadata'], 'idx_pe_integration_metadata');
    table.dropColumn('integration_metadata');
  });
};
