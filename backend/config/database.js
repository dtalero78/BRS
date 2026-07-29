const knex = require('knex');
require('dotenv').config();

const config = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: '../migrations'
    },
    seeds: {
      directory: '../seeds'
    }
  },
  
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      // El cluster `brs` es db-s-1vcpu-1gb: max_connections=25, de las cuales
      // Postgres/DO reservan ~3 para superusuario y monitoreo. Con dos apps
      // sobre el MISMO cluster (BRS y el licenciatario), un max de 20 por app
      // pide 40 sobre ~22 disponibles y la segunda en pedir recibe
      // "53300 remaining connection slots are reserved".
      //
      // 8 por app deja 16 en uso y margen para migraciones y diagnostico. Al
      // agotarse el pool, knex ENCOLA la peticion en vez de fallar, que es
      // preferible a un 500. Si se sube el tier del cluster, subir este valor
      // por env sin tocar codigo.
      max: Number(process.env.DB_POOL_MAX) || 8,
      acquireTimeoutMillis: 30000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: '../migrations'
    },
    seeds: {
      directory: '../seeds'
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Conexión a base de datos establecida');
  })
  .catch((err) => {
    console.error('❌ Error conectando a base de datos:', err.message);
  });

module.exports = db;