const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('users').del();
  await knex('companies').del();
  await knex('system_configs').del();

  // Insert initial company
  const [company] = await knex('companies').insert({
    name: 'Sistema BRS Digital',
    nit: '900000000-1',
    contact_email: 'admin@brsdigital.com',
    contact_phone: '123-456-7890',
    active: true
  }).returning('*');

  // Insert admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await knex('users').insert({
    email: 'admin@brsdigital.com',
    password_hash: hashedPassword,
    role: 'admin',
    company_id: company.id,
    active: true
  });

  // Insert system configurations
  await knex('system_configs').insert([
    {
      config_key: 'cuestionarios_data',
      config_value: null,
      description: 'Datos estructurados de los cuestionarios BRS'
    },
    {
      config_key: 'baremos_intralaboral_forma_a',
      config_value: null,
      description: 'Baremos oficiales BRS para cuestionario intralaboral forma A'
    },
    {
      config_key: 'baremos_intralaboral_forma_b',
      config_value: null,
      description: 'Baremos oficiales BRS para cuestionario intralaboral forma B'
    },
    {
      config_key: 'baremos_extralaboral',
      config_value: null,
      description: 'Baremos oficiales BRS para cuestionario extralaboral'
    },
    {
      config_key: 'baremos_estres',
      config_value: null,
      description: 'Baremos oficiales BRS para cuestionario de estrés'
    },
    {
      config_key: 'baremos_puntaje_total',
      config_value: null,
      description: 'Baremos oficiales BRS para puntajes totales generales'
    }
  ]);

  console.log('✅ Datos iniciales insertados:');
  console.log('   - Empresa: Sistema BRS Digital');
  console.log('   - Usuario admin: admin@brsdigital.com / admin123');
  console.log('   - Configuraciones del sistema inicializadas');
};