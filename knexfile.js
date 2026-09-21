'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (process.env.NODE_ENV === 'development' && process.env.DB_NAME && process.env.DB_NAME !== 'mini_hrms') {
    throw new Error('Database migrations require DB_NAME=mini_hrms.');
}
module.exports = {
    client: process.env.DB_CLIENT || 'mysql',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'mini_hrms',
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
