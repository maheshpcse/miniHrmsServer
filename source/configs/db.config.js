const mysql = require('mysql');
const bcrypt = require('bcrypt');
const moment = require('moment');
const serverConfig = require('./server.config.js');
const spConfig = require('../configs/spConfig.js');
const userSP = require('../libraries/userSP.js');

const connection = mysql.createConnection({
    host: serverConfig.database.host,
    port: serverConfig.database.port,
    user: serverConfig.database.username,
    password: serverConfig.database.password,
    database: serverConfig.database.db,
    multipleStatements: true,
    charset: 'utf8'
});

// checking database connection with mysql config
const checkDatabaseConnection = async (request, response, next) => {
    await connection.connect(function (err, data) {
        if (err) {
            const result = {
                data: err
            }
            if (result.data.errno === 'ECONNREFUSED') {
                console.log("Databse connection refused, check your database connection", err);
                return response.status(200).json({
                    success: false,
                    statusCode: 500,
                    message: 'Databse connection refused, check your database connection',
                    data: err
                });
            } else if (result.data.code === 'ER_ACCESS_DENIED_ERROR') {
                console.log("Database access denied for user, check your database credentials", err);
                return response.status(200).json({
                    success: false,
                    statusCode: 500,
                    message: 'Database access denied for user, check your database credentials',
                    data: err
                });
            }
        } else if (data) {
            console.log("Database connection established", data);
            return response.status(200).json({
                success: true,
                statusCode: 200,
                message: 'Database connection established',
                data: data
            });
        }
    });
}

// add default admin login data - POST METHOD
const addDefaultAdminLoginData = async (request, response, next) => {
    console.log('In addDefaultAdminLoginData(), request body isss', request.body);

    let result = {};
    let message = '';

    try {
        const defaultAdminInfoData = [null, 'ADMIN001', 'admin', 'mahesh', 'adminmahesh', 'adminmahesh@minihrms.com', null, null, 'admin', 1, 1, new Date(), new Date()];

        defaultAdminInfoData[6] = JSON.stringify({
            Address: "8th block, Koramangala",
            City: "Benguluru",
            State: "Karnataka",
            Country: "India",
            Pincode: "560095"
        });
        defaultAdminInfoData[7] = JSON.stringify({
            Image: "",
            Mobile: "8985341585",
            DateOfBirth: "1997-04-08"
        });

        const defaultAdminLoginData = [null, '1234', '1234', 0, null, null];

        // hash and encrypt admin password
        await bcrypt.hash(defaultAdminLoginData[1], 10).then(async hash => {
            console.log('admin login hash password isss:', hash);
            defaultAdminLoginData[1] = hash;
        }).catch(hashErr => {
            message = 'Error while encrypt the login password';
            throw hashErr;
        });

        await bcrypt.hash(defaultAdminLoginData[2], 10).then(async hash => {
            console.log('admin settings hash password isss:', hash);
            defaultAdminLoginData[2] = hash;
        }).catch(hashErr => {
            message = 'Error while encrypt the settings password';
            throw hashErr;
        });

        defaultAdminLoginData[5] = JSON.stringify({
            LoginPasswordUpdatedOn: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            LoginPasswordExpiryDate: moment().add(15, 'days').format('YYYY-MM-DD HH:mm:ss'),
            SettingsPasswordUpdatedOn: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            SettingsPasswordExpiryDate: moment().add(7, 'days').format('YYYY-MM-DD HH:mm:ss'),
        });
        
        await userSP.insertOrUpdateDataSP(spConfig.ADD_DEFAULT_ADMIN_LOGIN_DATA, [...defaultAdminInfoData ,...defaultAdminLoginData], null).then(resData => {
            console.log('Get added default admin login resData isss', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: 'Default admin login data is added successful',
                data: resData
            }
        }).catch(errData => {
            message = message || 'Error while adding default admin login data';
            throw errData;
        });
    } catch (error) {
        console.log('Error at try catch API result', error);
        result = {
            success: false,
            error: true,
            statusCode: 500,
            message: message || 'Error at try catch API result',
            data: error
        }
    }

    return response.status(200).json(result);
}

// add sample employees data - POST METHOD


module.exports = {
    connection,
    checkDatabaseConnection,
    addDefaultAdminLoginData
};