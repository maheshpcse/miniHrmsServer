'use strict';

// ********************* NPM Modules ***********************************
// required npm modules
// require('./config/dbBackup.js');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const mysql = require('mysql');
const cookieParser = require('cookie-parser');
const { Model } = require('objection');
const serverConfig = require('./configs/server.config.js');
const dbConfig = require('./configs/db.config.js');
const Knexx = require('./configs/knex.js');
const adminRoutes = require('./routes/admin.route.js');
var moment = require('moment-timezone');

// var filePath = fs.readFileSync('./../');

Model.knex(Knexx.knex);
const app = express();

// ********************* Middlewares ***********************************
// required middlewares
app.use('/', express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static(path.join('uploads')));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(async (request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE,PATCH, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Origin, Authorization, x-access-token, Content-Length, X-Requested-With, Content-Type, Accept");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    next();
});

// Set 'views' directory for any views 
// being rendered res.render()
app.set('views', 'views');

// Set view engine as EJS
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
// app.use((req, res, next) => {
//     res.render("../public/dist/ucmsUI/views/site");
//     res.sendFile(path.join(__dirname, "../public/dist/ucmsUI/index.html"));
//     console.log('req isss:', req.baseUrl, process.env.APP_BASE_URL);
//     res.redirect(req.headers.host + '');
// });

// ********************* Routes ***********************************
// checking database connection
app.get('/test_db_connection', dbConfig.checkDatabaseConnection);

// required routes configuration
app.use('/api', adminRoutes);

app.listen(serverConfig.server.port, () => {
    console.log(`MiNi HRMS server is listening on http://${serverConfig.server.host}:${serverConfig.server.port}`);
});

module.exports = app;