'use strict';

// ********************* NPM Modules ***********************************
// required npm modules
// require('./config/dbBackup.js');
// require('./configs/aws-sdk.config.js');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const mysql = require('mysql');
const cookieParser = require('cookie-parser');
const { Model } = require('objection');
const logger = require('./configs/logger.config.js');
const serverConfig = require('./configs/server.config.js');
const dbConfig = require('./configs/db.config.js');
const Knexx = require('./configs/knex.js');
const adminRoutes = require('./routes/admin.route.js');
const portalRoutes = require('./portal');

Model.knex(Knexx.knex);
const app = express();
const httpConfig = require('./configs/http.config');
app.set('trust proxy', httpConfig.trustProxy);

// Log request metadata to the terminal, never credentials, bodies or query strings.
app.use((req, res, next) => {
    const started = Date.now();
    const requestPath = req.path.replace(/[\r\n]/g, '');
    res.on('finish', () => {
        const message = req.method + ' ' + requestPath + ' ' + res.statusCode + ' ' + (Date.now() - started) + 'ms';
        if (res.statusCode >= 500) logger.error(message);
        else logger.info(message);
    });
    next();
});

// ********************* Middlewares ***********************************
// required middlewares
app.use('/', express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static(path.join('uploads')));
app.use(cors(httpConfig.cors));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());


// Set 'views' directory for any views 
// being rendered res.render()
app.set('views', 'views');

// Set view engine as EJS
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
// app.use((req, res, next) => {
//     res.render("../public/dist/ucmsUI/views/site");
//     res.sendFile(path.join(__dirname, "../public/dist/ucmsUI/index.html"));
//     logger.info('req isss:', req.baseUrl, process.env.APP_BASE_URL);
//     res.redirect(req.headers.host + '');
// });

// ********************* Routes ***********************************
// checking database connection
app.get('/test_db_connection', portalRoutes.handlers.authenticate, (req,res,next) => req.user.roleName === 'admin' ? next() : res.status(403).json({success:false,message:'Administrator access required.'}), dbConfig.checkDatabaseConnection);

// required routes configuration
app.get('/api/server', (req,res) => res.json({success:true,message:'MiNi HRMS API is available.'}));
app.get('/api/health/ready', async (req, res) => {
    try {
        await Knexx.knex('portal_sessions').select('id').limit(1);
        res.json({success:true,message:'Database and HRMS schema are ready.'});
    } catch (_) { res.status(503).json({success:false,message:'Database is not ready.'}); }
});
app.use('/api/portal', portalRoutes);
// Keep the old authentication URLs compatible without exposing the old client-side OTP flow.
app.post('/api/get_admin_login', portalRoutes.handlers.login);
app.post('/api/get_validate_admin_email', portalRoutes.handlers.forgot);
app.post('/api/update_admin_password', portalRoutes.handlers.reset);
app.post('/api/admin_and_settings_logout', portalRoutes.handlers.authenticate, portalRoutes.handlers.logout);
app.post('/api/add_default_admin_login_data', (req,res) => res.status(410).json({success:false,message:'Public default-account setup is disabled. Use your existing administrator account.'}));
app.use('/api', portalRoutes.handlers.authenticate, (req,res,next) => {
    if(req.user.roleName !== 'admin') return res.status(403).json({success:false,message:'Administrator access required.'});
    next();
}, adminRoutes);
app.use(portalRoutes.handlers.errorHandler);

const listenPort = Number(process.env.PORT || 3663);
const listenHost = process.env.HOST === 'localhost' ? '127.0.0.1' : (process.env.HOST || '0.0.0.0');
const server = app.listen(listenPort, listenHost, () => {
    logger.info('MiNi HRMS server is listening on http://' + listenHost + ':' + listenPort);
});
server.on('error', error => {
    logger.error('Unable to start HRMS API (' + error.code + '). Check that its port is available.');
    process.exitCode = 1;
    Knexx.knex.destroy();
});

process.on('SIGTERM', () => {
    server.close(() => Knexx.knex.destroy().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
});
module.exports = app;