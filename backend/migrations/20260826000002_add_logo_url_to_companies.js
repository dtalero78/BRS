/**
 * Logo de co-marca por empresa, para la pantalla del participante.
 *
 * Distinto de `config/brand.ts`: esa marca es de la INSTANCIA y se hornea en
 * build (`NEXT_PUBLIC_BRAND`), asi que no sirve cuando dentro de una misma
 * instancia cada empresa necesita mostrar su propio logo junto al de la
 * plataforma. Se guarda una ruta o URL, no la imagen: los assets propios viven
 * en `frontend/public/brand/<marca>/`.
 *
 * NULL = solo se muestra el logo de la plataforma (comportamiento de siempre).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('companies', 'logo_url');
  if (!exists) {
    await knex.schema.alterTable('companies', (table) => {
      table.string('logo_url', 500).nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const exists = await knex.schema.hasColumn('companies', 'logo_url');
  if (exists) {
    await knex.schema.alterTable('companies', (table) => {
      table.dropColumn('logo_url');
    });
  }
};
