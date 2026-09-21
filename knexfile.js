'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { databaseName } = require('./source/configs/database-target');
module.exports = {
    client: process.env.DB_CLIENT || 'mysql',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: databaseName(),
        charset: 'utf8mb4',
        multipleStatements: false
    },
    pool: { min: 0, max: 2 },
    migrations: {
        directory: path.join(__dirname, 'db_migrations'),
        tableName: 'knex_migrations',
        loadExtensions: ['.js']
    }
};
