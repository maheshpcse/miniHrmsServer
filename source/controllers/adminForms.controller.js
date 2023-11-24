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
            console.log('Get saved login encrypt resData isss:', resData);

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

// GET login encrypt data - POST METHOD
const getLoginEncryptData = async (request, response, next) => {
    console.log('In getLoginEncryptData(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        let { limit, offset } = request.body;
        // offset = (offset - 1) * limit;

        await userSP.selectDataSP(spConfig.GET_LOGIN_ENCRYPT_DATA, [limit, offset], null).then(async resData => {
            console.log('Get login encrypt resData isss:', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: 'Get login encrypt data successful',
                data: {
                    list: resData && resData.length ? resData[0][0] : [],
                    count: resData && resData.length ? resData[0][1][0]['count'] : 0
                }
            }
        }).catch(errData => {
            message = message || 'Error while getting login encrypt data';
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

// UPDATE login encrypt data status - POST METHOD
const updateLoginEncryptDataStatus = async (request, response, next) => {
    console.log('In updateLoginEncryptDataStatus(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        const { loginEncDecDetailId, status } = request.body;

        await userSP.insertOrUpdateDataSP(spConfig.UPDATE_LOGIN_ENCRYPT_DATA_STATUS, [loginEncDecDetailId, status], null).then(async resData => {
            console.log('Get updated login encrypt status resData isss:', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: status == 0 ? 'Login Encrypt data deactivated successful' : 'Login Encrypt data activated successful',
                data: resData
            }
        }).catch(errData => {
            message = message || 'Error while updating login encrypt data status';
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
    saveLoginEncryptData,
    getLoginEncryptData,
    updateLoginEncryptDataStatus
}