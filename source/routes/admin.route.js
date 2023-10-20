const express = require('express');
const router = express.Router();
const dbConfig = require('../configs/db.config.js');
const authAdminCtrl = require('../controllers/authAdmin.controller.js');

// Server routes
router.get('/', (request, response, next) => {
    return response.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Basic server route works!'
    });
});

// Admin authentication routes
router.post('/add_default_admin_login_data', dbConfig.addDefaultAdminLoginData);
router.post('/get_admin_login', authAdminCtrl.getAdminLogin);
router.post('/admin_and_settings_logout', authAdminCtrl.validateAdminLogin, authAdminCtrl.getAdminAndSettingsLogout);
router.post('/get_validate_admin_email', authAdminCtrl.getValidateAdminEmail);
router.post('/update_admin_password', authAdminCtrl.updateAdminPassword);

module.exports = router;