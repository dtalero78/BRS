/**
 * Marca de envio de la invitacion por WhatsApp.
 *
 * Sin esto, "ya le envie" solo vive en la pantalla del evaluador y se pierde al
 * recargar. Con 703 destinatarios eso importa: es lo que permite reintentar
 * SOLO a los que no recibieron, en vez de reenviarle a todos —que ademas es
 * justo lo que dispara reportes de spam.
 *
 * Nullable a proposito: NULL = nunca se envio.
 */
exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('participant_evaluations', 'whatsapp_sent_at');
  if (existe) return;

  await knex.schema.alterTable('participant_evaluations', (table) => {
    table.timestamp('whatsapp_sent_at').nullable();
    // SID del mensaje en Twilio: sin el, diagnosticar un "no me llego" obliga
    // a cruzar la consola de Twilio por telefono y fecha.
    table.string('whatsapp_message_sid', 64).nullable();
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('participant_evaluations', 'whatsapp_sent_at');
  if (!existe) return;

  await knex.schema.alterTable('participant_evaluations', (table) => {
    table.dropColumn('whatsapp_sent_at');
    table.dropColumn('whatsapp_message_sid');
  });
};
