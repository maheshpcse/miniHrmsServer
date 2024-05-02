const moment = require('moment');
const bcrypt = require('bcrypt');
const JWT = require('jsonwebtoken');
const randomString = require('randomstring');
const nodemailer = require('nodemailer');
const serverConfig = require('../configs/server.config.js');
const spConfig = require('../configs/spConfig.js');
const userSP = require('../libraries/userSP.js');

// GET admin login - POST METHOD
const getAdminLogin = async (request, response, next) => {
    console.log('In getAdminLogin(), request body isss', request.body);

    let result = {};
    let message = '';

    try {
        const { adminLoginName, adminPassword } = request.body;

        await userSP.selectDataSP(spConfig.GET_ADMIN_LOGIN, [adminLoginName], null).then(async resData => {
            console.log('Get admin login resData isss', resData);
            
            if (resData && resData.length > 0) {
                const adminLoginData = Object.assign({}, resData[0][0][0]) || {};
                // console.log('adminLoginData isss:', adminLoginData);
                adminLoginData['role'] = adminLoginData['roleName'] || '';

                // Validate Password expiry date
                const isPwdExpiry = moment().format('YYYY-MM-DD HH:mm:ss') <= adminLoginData.loginPasswordExpiryDate ? false : true;
                console.log('is adminPassword Expiry isss', isPwdExpiry);

                if (isPwdExpiry) {
                    message = message || 'AdminPassword is expired';
                    throw new Error(message);
                }

                // Validate Password match
                const isMatchPwd = await bcrypt.compare(adminPassword, adminLoginData.adminPassword);
                console.log('is Match adminPassword isss', isMatchPwd);

                if (isMatchPwd) {
                    // Audit admin login data
                    const auditLoginPayload = [adminLoginData.empId,1,adminLoginData.lastLoginTime,null,null,request.ip];

                    await userSP.insertOrUpdateDataSP(spConfig.SAVE_AUDIT_EMPLOYEE_ADMIN_LOGIN, auditLoginPayload, null).then(async resData1 => {
                        console.log('Get save audit admin login resData isss', resData1);
                        if (resData1 && resData1.length > 0 && resData1[0]['audit_login_id'] <= 0) {
                            message = message || 'Admin data is not found';
                            throw new Error(message);
                        } else {
                            adminLoginData['auditLoginId'] = resData1[0]['audit_login_id'];
                        }
                    }).catch(errData1 => {
                        message = message || 'Error while updating audit admin login data';
                        throw errData1;
                    });

                    const encryptData = {
                        adminLoginId: adminLoginData.adminLoginId,
                        empId: adminLoginData.empId,
                        adminLoginName: adminLoginData.adminLoginName,
                        email: adminLoginData.email,
                        role: adminLoginData.roleName
                    }
                    const accessToken = JWT.sign(encryptData, serverConfig.database.securitykey, {
                        algorithm: 'HS256',
                        expiresIn: '1h'
                    });
                    const refreshToken = JWT.sign(encryptData, serverConfig.database.securitykey, {
                        algorithm: 'HS256',
                        expiresIn: '1h'
                    });

                    adminLoginData['token'] = accessToken;
                    adminLoginData['accessToken'] = accessToken;
                    adminLoginData['refreshToken'] = refreshToken;
                    adminLoginData['issued'] = moment().format('YYYY-MM-DD HH:mm:ss');
                    adminLoginData['expired'] = moment().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss');

                    result = {
                        success: true,
                        error: false,
                        statusCode: 200,
                        message: 'Admin login successful',
                        data: adminLoginData
                    }
                } else {
                    message = message || 'AdminPassword is invalid';
                    throw new Error(message);
                }
            } else if (resData && resData.length == 0) {
                message = message || 'AdminLoginName is invalid';
                throw new Error(message);
            }
        }).catch(errData => {
            message = message || 'Error while finding adminLoginName';
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

// Validate Admin login - POST METHOD
const validateAdminLogin = async (request, response, next) => {
    console.log('In validateAdmin(), request headers isss', request.headers);

    let adminLoginData = {};
    let message = '';

    try {
        let authorizedToken = request.headers['authorization'] || request.headers['x-access-token'];
        console.log('authorizedToken isss:', authorizedToken);

        if (!authorizedToken || authorizedToken === '') {
            message = message || 'Token is not found';
            throw new Error(message);
        } else {
            authorizedToken = authorizedToken.split(',')[0];
        }

        // console.log('Final authorizedToken isss', authorizedToken);

        await JWT.verify(authorizedToken, serverConfig.database.securitykey, async (err, decoded) => {
            if (err) {
                // console.log('Error jwt token verification data isss:', err);
                message = err && err.message ? err.message : 'Error while verifying the jwt token';
                throw new Error(message);
            } else {
                console.log('decoded data isss:', decoded);

                await userSP.selectDataSP(spConfig.GET_ADMIN_LOGIN, [decoded.adminLoginName], null).then(async resData => {
                    console.log('Get admin login resData isss', resData);

                    adminLoginData = resData && resData.length ? resData[0][0][0] : {};

                    if (adminLoginData && Object.keys(adminLoginData).length == 0) {
                        message = message || 'Admin Login data is invalid or not found';
                        throw new Error(message);
                    } else if (decoded.adminLoginName == adminLoginData.adminLoginName) {
                        next();
                    } else {
                        message = message || 'Token is invalid';
                        throw new Error(message);
                    }
                }).catch(errData => {
                    message = message || 'Error while getting admin login data';
                    throw errData;
                });
            }
        });
    } catch (error) {
        console.log('Error at try catch API result', error);

        return response.status(200).json({
            success: false,
            error: true,
            statusCode: 500,
            message: message || 'Error at try catch API result',
            data: error
        });
    }
}

// GET admin and settings logout - POST METHOD
const getAdminAndSettingsLogout = async (request, response, next) => {
    console.log('In getAdminAndSettingsLogout(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        const { adminLoginId, auditLoginId } = request.body;

        await userSP.insertOrUpdateDataSP(spConfig.GET_ADMIN_AND_SETTINGS_LOGOUT, [adminLoginId, auditLoginId], null).then(async resData => {
            console.log('Get Admin and Settings logout resData isss:', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: 'Admin logout successful',
                data: resData
            }
        }).catch(errData => {
            message = message || 'Error while unable to logout the admin session';
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

// GET validate admin email - POST METHOD
const getValidateAdminEmail = async (request, response, next) => {
    console.log('In getValidateAdminEmail(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        const { adminEmail } = request.body;

        await userSP.selectDataSP(spConfig.GET_VALIDATE_ADMIN_EMAIL, [adminEmail], null).then(async resData => {
            console.log('Get validate admin email resData isss:', resData);

            const { isValidEmail = true, userName = null } = resData && resData.length > 0 ? resData[0] : { isValidEmail: false, userName: null };

            if (isValidEmail == false) {
                message = message || 'Admin email is invalid or not found';
                    throw new Error(message);
            } else {
                // To send an OTP to admin email
                const transporter = nodemailer.createTransport({
                    service: 'Gmail',
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    // host: "smtp.gmail.com",
                    // port: 587,
                    // secure: false,
                    auth: {
                        user: serverConfig.email.name,
                        // pass: serverConfig.email.password
                        pass: 'yhor lbxz erbg dwto'
                    }
                });

                const oneTimePassword = randomString.generate({
                    length: 6,
                    charset: 'numeric'
                });

                const mailOptions = {
                    from: serverConfig.email.name,
                    to: `${adminEmail}`,
                    subject: 'A new OTP verification code to Forgot Password request',
                //     html: `<div style="padding: 15px; border: 2px solid #ccc !important;">
                //     <div style="width:50%;box-shadow: 0 4px 10px 0 rgba(0, 0, 0, 0.2), 0 4px 20px 0 rgba(0, 0, 0, 0.19);margin: 0 auto;">
                //         <header style="height: 100px;text-align: center !important;border: 3px solid cornflowerblue;background-color: cornflowerblue !important;">
                //             <h6 style="font-size: 1.3rem;color: white;margin: 5.5%;">OTP Mail - MiNi HRMS</h6>
                //         </header>
                
                //         <div style="padding: 5px;text-align: center !important;height: 130px;">
                //             <p style="font-size: 1.1rem;">Hi <b style="color: mediumseagreen;">${userName}</b>, Greetings From <b style="color: seagreen;">MiNi HRMS</b> App!</p>
                //             <br>
                //             <div>
                //                 Please change password with newly generated OTP : <span class="otp-code w3-wide" style="font-weight: 400;padding: 10px;
                //                 border: 1px dashed teal;color: #1667af;letter-spacing: 4px;">${oneTimePassword}</span>
                //             </div>
                //         </div>
                //     </div>
                // </div>`
                    html: `<!DOCTYPE html>
                    <html lang="en">
                    
                    <head>
                        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Verify your login</title>
                        <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
                    </head>
                    
                    <body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #ffffff;">
                        <table role="presentation"
                            style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: rgb(239, 239, 239);">
                            <tbody>
                                <tr>
                                    <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
                                        <table role="presentation"
                                            style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
                                            <tbody>
                                                <tr>
                                                    <td style="padding: 40px 0px 0px;">
                                                        <div style="text-align: left;">
                                                            <div style="padding-bottom: 0px;"><img src="http://localhost:7200/assets/images/mini_hrms_logo.png"
                                                                    alt="Company" style="width: 50%;"></div>
                                                        </div>
                                                        <div style="padding: 20px; background-color: rgb(255, 255, 255);">
                                                            <div style="color: rgb(0, 0, 0); text-align: left;">
                                                                <h1 style="margin: 1rem 0">OTP Verification code</h1>
                                                                <p style="padding-bottom: 16px">
                                                                    Please use below verification code to Change Password.
                                                                </p>
                                                                <p style="padding-bottom: 16px">Note: Valid for 10 minutes only.</p>
                                                                <p style="padding-bottom: 16px">
                                                                    <strong style="font-size: 130%">${oneTimePassword}</strong>
                                                                </p>
                                                                <p style="padding-bottom: 16px">
                                                                    If you didn't request this, you can ignore this email.
                                                                </p>
                                                                <p style="padding-bottom: 16px">Thanks,<br>MiNi HRMS team</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </body>
                    
                    </html>`
                }

                await transporter.sendMail(mailOptions, async (err, info) => {
                    if (err) {
                        console.log('Error while sending an email', err);
                        // message = message || 'Error while sending an email';
                        // throw err;
                        result = {
                            success: false,
                            error: true,
                            statusCode: 500,
                            message: 'Error while sending an email',
                            data: null
                        }
                        return response.status(200).json(result);
                    } else {
                        console.log('Get sent mail info isss', info);

                        result = {
                            success: true,
                            error: false,
                            statusCode: 200,
                            message: 'An OTP sent successful',
                            data: { otp: oneTimePassword }
                        }
                        return response.status(200).json(result);
                    }
                });
            }
        }).catch(errData => {
            message = message || 'Error while validating admin email';
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
        return response.status(200).json(result);
    }
}

// TODO: UPDATE admin password - POST METHOD
const updateAdminPassword = async (request, response, next) => {
    console.log('In updateAdminPassword(), request body isss:', request.body);

    let result = {};
    let message = '';

    try {
        let { adminEmail, password, hashPassword = null } = request.body;

        // step 1: hash and encrypt admin new password
        await bcrypt.hash(password, 10).then(async hash => {
            console.log('hash new password isss:', hash);
            hashPassword = hash;
        }).catch(hashErr => {
            message = message || 'Error while encrypt the new password';
            throw hashErr;
        });

        await userSP.insertOrUpdateDataSP(spConfig.UPDATE_ADMIN_PASSWORD, [adminEmail, hashPassword], null).then(async resData => {
            console.log('Get update admin password resData isss:', resData);

            result = {
                success: true,
                error: false,
                statusCode: 200,
                message: 'Admin password is updated successful',
                data: resData
            }
        }).catch(errData => {
            message = message || 'Error while updating admin password';
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
    getAdminLogin,
    validateAdminLogin,
    getAdminAndSettingsLogout,
    getValidateAdminEmail,
    updateAdminPassword
}