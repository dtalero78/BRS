const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // GUARDA ANTI-PRODUCCIÓN: este seed BORRA users/companies/system_configs.
  // Nunca debe correr contra la BD de producción. Requiere opt-in explícito.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error(
      'Seed destructivo bloqueado en producción. Para forzarlo (borra TODOS los datos) ' +
      'exporta ALLOW_DESTRUCTIVE_SEED=true. NO lo hagas contra la BD real.'
    );
  }

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

  // Insert admin user. La contraseña NO se hardcodea: se toma de env.
  // Define SEED_ADMIN_PASSWORD antes de correr el seed (repo público — sin defaults en claro).
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('Falta SEED_ADMIN_PASSWORD para crear el usuario admin del seed.');
  }
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
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
  console.log('   - Usuario admin: admin@brsdigital.com (password desde SEED_ADMIN_PASSWORD)');
  console.log('   - Configuraciones del sistema inicializadas');
};