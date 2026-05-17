exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.string('full_name', 255).nullable();
    table.string('professional_title', 255).nullable();
    table.string('license_number', 100).nullable();
    table.text('signature_image').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('full_name');
    table.dropColumn('professional_title');
    table.dropColumn('license_number');
    table.dropColumn('signature_image');
  });
};
