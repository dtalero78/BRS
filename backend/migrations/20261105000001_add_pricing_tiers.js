/**
 * Tarifas escalonadas por volumen, con acuerdos por evaluador.
 *
 * Hasta ahora la tarifa eran dos numeros sueltos en env vars
 * (`BRS_TEST_PRICE_COP` y `BRS_TEST_PRICE_BULK_COP`): un precio base y uno
 * por volumen, iguales para toda la instancia. Eso no alcanza para dos cosas
 * que el negocio ya necesita: mas de dos tramos, y un acuerdo distinto con
 * un evaluador concreto sin cambiarle el precio a los demas.
 *
 * Un tramo es "desde `min_qty` pruebas, cada prueba cuesta `unit_price_cop`".
 * El precio aplica a TODA la orden (ver nota del salto en CLAUDE.md), no solo
 * a las pruebas que exceden el umbral.
 *
 * `user_id NULL` = tarifa de la instancia. `user_id` con valor = acuerdo con
 * ese evaluador, que reemplaza por completo a la global (no se mezclan: media
 * tabla de un acuerdo y media de otro daria precios que nadie negocio).
 *
 * Sin filas, el calculo cae a las env vars de siempre, asi que una instancia
 * que no use esto no cambia en nada.
 */
exports.up = async function (knex) {
  // A proposito SIN un `if (hasTable) return`: knex ya garantiza que esto
  // corra una sola vez (`knex_migrations`). Ese guard solo serviria si la
  // tabla la hubiera creado alguien a mano, y entonces la migracion quedaria
  // marcada como aplicada SIN los indices unicos ni el CHECK — la base
  // aceptaria min_qty duplicados y precios en 0. En este repo la deriva de
  // esquema ya costo caro (nota 13 del CLAUDE.md), asi que ese caso debe
  // fallar ruidosamente y no en silencio.
  await knex.schema.createTable('pricing_tiers', (table) => {
    table.increments('id').primary();
    // NULL = tarifa de la instancia; con valor = acuerdo con ese evaluador.
    table.integer('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('min_qty').notNullable();
    table.integer('unit_price_cop').notNullable();
    // Para que dentro de un ano se sepa de donde salio este precio.
    table.string('note', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index('user_id');
  });

  // Un UNIQUE(user_id, min_qty) a secas NO sirve: en Postgres dos NULL no
  // colisionan, asi que la tarifa global podria tener el mismo min_qty
  // repetido y el calculo elegiria cualquiera de los dos precios.
  await knex.raw(`
    CREATE UNIQUE INDEX pricing_tiers_global_min_qty_unique
      ON pricing_tiers (min_qty) WHERE user_id IS NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX pricing_tiers_user_min_qty_unique
      ON pricing_tiers (user_id, min_qty) WHERE user_id IS NOT NULL
  `);

  // Un precio de 0 vaciaria el cobro en silencio; un min_qty de 0 dejaria la
  // tabla sin tramo de arranque definido.
  await knex.raw('ALTER TABLE pricing_tiers ADD CONSTRAINT pricing_tiers_positive CHECK (min_qty >= 1 AND unit_price_cop > 0)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pricing_tiers');
};
