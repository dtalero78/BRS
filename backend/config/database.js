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
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: '../migrations'
    },
    seeds: {
      directory: '../seeds'
    },
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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