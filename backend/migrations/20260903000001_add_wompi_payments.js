/**
 * Pagos por prueba con Wompi.
 *
 * Hasta ahora el cobro era manual: el admin marcaba `evaluations.paid` y con
 * eso se liberaban los informes de TODA la evaluacion. Con Wompi el evaluador
 * paga por su cuenta y por PRUEBA (cada participant_evaluation), asi que el
 * desbloqueo pasa a vivir en la fila de la prueba: `paid_at` no nulo = pagada.
 *
 * `evaluations.paid` se conserva como interruptor grueso del admin (cortesias,
 * convenios, licenciatarios): si esta en true, libera aunque las pruebas no
 * tengan `paid_at`.
 *
 * `payments` es una orden de pago: un intento de checkout con N pruebas. Se
 * crea ANTES de mandar al evaluador a Wompi, porque la referencia que viaja al
 * checkout tiene que existir aqui para que el webhook la reconozca despues.
 * Puede quedar `pending` para siempre si la persona cierra la ventana.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('payments'))) {
    await knex.schema.createTable('payments', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      // Referencia que viaja a Wompi. Unica: es la llave con la que el webhook
      // y la verificacion post-redirect encuentran la orden.
      table.string('reference', 64).notNullable().unique();
      table.bigInteger('amount_in_cents').notNullable();
      table.string('currency', 3).notNullable().defaultTo('COP');
      table.integer('unit_price_in_cents').notNullable();
      table.integer('quantity').notNullable();
      // pending | approved | declined | voided | error
      table.string('status', 16).notNullable().defaultTo('pending');
      table.string('wompi_transaction_id', 64).nullable();
      table.string('payment_method', 32).nullable();
      // Ultimo objeto `transaction` recibido de Wompi (webhook o consulta),
      // para diagnosticar un "pague y no se libero" sin ir al dashboard.
      table.jsonb('wompi_payload').nullable();
      table.timestamp('approved_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['user_id', 'created_at']);
      table.index('wompi_transaction_id');
    });
  }

  if (!(await knex.schema.hasTable('payment_items'))) {
    await knex.schema.createTable('payment_items', (table) => {
      table.increments('id').primary();
      table.integer('payment_id').notNullable().references('id').inTable('payments').onDelete('CASCADE');
      table.integer('participant_evaluation_id').notNullable()
        .references('id').inTable('participant_evaluations').onDelete('CASCADE');
      table.unique(['payment_id', 'participant_evaluation_id']);
      table.index('participant_evaluation_id');
    });
  }

  if (!(await knex.schema.hasColumn('participant_evaluations', 'paid_at'))) {
    await knex.schema.alterTable('participant_evaluations', (table) => {
      table.timestamp('paid_at').nullable();
      table.integer('payment_id').nullable().references('id').inTable('payments').onDelete('SET NULL');
      table.index('paid_at');
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('participant_evaluations', 'paid_at')) {
    await knex.schema.alterTable('participant_evaluations', (table) => {
      table.dropColumn('payment_id');
      table.dropColumn('paid_at');
    });
  }
  await knex.schema.dropTableIfExists('payment_items');
  await knex.schema.dropTableIfExists('payments');
};
