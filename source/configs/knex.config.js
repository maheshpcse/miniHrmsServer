const path = require('path');
const serverConfig = require('./server.config.js');

module.exports = {
    client: process.env.DB_CLIENT || 'mysql',
    connection: {
        timezone: 'Z',
        host: serverConfig.database.host,
        port: serverConfig.database.port,
        user: serverConfig.database.username,
        password: serverConfig.database.password,
        database: serverConfig.database.db,
        multipleStatements: true,
        charset: 'utf8'
    },
    pool: {
        afterCreate: (connection, done) => connection.query("SET time_zone = '+00:00'", error => done(error, connection)),
        max: 10,
        min: 3
    },
    acquireTimeout: 60 * 1000,
    debug: false,
    migrations: {
        directory: path.resolve(__dirname, '../../db_migrations')
    },
    seeds: {
        directory: '../seeds'
    }
}