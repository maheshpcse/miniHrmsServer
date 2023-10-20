require('dotenv').config();

module.exports = {
    server: {
        host: process.env.HOST,
        port: process.env.PORT
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        db: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        securitykey: process.env.SECURITY_KEY
    },
    email: {
        name: process.env.MAIL_NAME,
        password: process.env.MAIL_PASSWORD
    }
}