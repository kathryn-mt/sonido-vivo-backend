
require('dotenv').config();

const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    ca: fs.readFileSync(
      path.resolve(__dirname, process.env.DB_SSL_CA || './global-bundle.pem'),
      'utf8'
    ),
    rejectUnauthorized: true
  },
  connectionTimeoutMillis: 5000
});

module.exports = pool;
