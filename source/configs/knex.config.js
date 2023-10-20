const serverConfig = require('./server.config.js');

module.exports = {
    client: 'mysql',
    connection: {
        host: serverConfig.database.host,
        port: serverConfig.database.port,
        user: serverConfig.database.username,
        password: serverConfig.database.password,
        database: serverConfig.database.db,
        multipleStatements: true,
        charset: 'utf8'
    },
    pool: {
        max: 10,
        min: 3
    },
    acquireTimeout: 60 * 1000,
    debug: false,
    migrations: {
        directory: '../db_migrations'
    },
    seeds: {
        directory: '../seeds'
    }
}