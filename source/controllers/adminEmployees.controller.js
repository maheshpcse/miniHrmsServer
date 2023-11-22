const moment = require('moment');
const bcrypt = require('bcrypt');
const JWT = require('jsonwebtoken');
const randomString = require('randomstring');
const nodemailer = require('nodemailer');
const serverConfig = require('../configs/server.config.js');
const spConfig = require('../configs/spConfig.js');
const userSP = require('../libraries/userSP.js');

// GET login history data - POST METHOD
const getLoginHistoryData = async (request, response, next) => {
    console.log('In getLoginHistoryData(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        let { limit, offset } = request.body;
        offset = (offset - 1) * limit;

        await userSP.selectDataSP(spConfig.GET_LOGIN_HISTORY_DATA, [limit, offset], null).then(async resData => {
            // console.log('Get login history resData isss:', resData);

            if (resData && resData.length) {
                for (const item of resData[0][0]) {
                    if (item['sessionTime']) {
                        let timeData = item['sessionTime'].split(':');
                        item['duration'] = `${timeData[0]} Hours ${timeData[1]} Minutes ${timeData[2]} Seconds`;
                    }
                }
            }

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: 'Get login history data successful',
                data: {
                    list: resData && resData.length ? resData[0][0] : [],
                    count: resData && resData.length ? resData[0][1][0]['count'] : 0
                }
            }
        }).catch(errData => {
            message = message || 'Error while getting login history data';
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
    getLoginHistoryData
}