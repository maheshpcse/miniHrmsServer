const moment = require('moment');
const bcrypt = require('bcrypt');
const JWT = require('jsonwebtoken');
const randomString = require('randomstring');
const nodemailer = require('nodemailer');
const serverConfig = require('../configs/server.config.js');
const spConfig = require('../configs/spConfig.js');
const userSP = require('../libraries/userSP.js');

// ADD or UPDATE login encrypt data - POST METHOD
const saveLoginEncryptData = async (request, response, next) => {
    console.log('In saveLoginEncryptData(), request body isss:', request.body);

    let result = {};
    let inputParams = [];
    let message = '';

    try {
        const { loginEncDecDetailId } = request.body;

        for (const [key, value] of Object.entries(request.body)) {
            inputParams.push(value);
        }
        console.log('Final inputParams isss:', inputParams);

        await userSP.insertOrUpdateDataSP(spConfig.SAVE_LOGIN_ENCRYPT_DATA, inputParams, null).then(async resData => {
            console.log('Get login encrypt resData isss:', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: !loginEncDecDetailId ? 'Login Encrypt data added successful' : 'Login Encrypt data updated successful',
                data: resData
            }
        }).catch(errData => {
            message = message || 'Error while adding or updating login encrypt data';
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

module.exports = {
    saveLoginEncryptData
}