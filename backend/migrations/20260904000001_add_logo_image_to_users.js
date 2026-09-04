/**
 * Logo de la empresa evaluadora (opcional) para la portada de los informes.
 *
 * Va en `users` y no en `companies`: `companies` son las empresas EVALUADAS
 * (las que contratan la medición), mientras que el logo que pide el mercado es
 * el de la consultora que firma el informe — la misma que ya aporta el nombre,
 * el título profesional y la firma digital de este mismo registro.
 *
 * Se guarda como data URL en TEXT, igual que `signature_image`: el disco de
 * App Platform es efímero, así que un archivo subido se perdería en el
 * siguiente deploy.
 */
exports.up = function (knex) {
  return knex.schema.table('users', function (table) {
    table.text('logo_image').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', function (table) {
    table.dropColumn('logo_image');
  });
};
