'use strict';
const { validate } = require('./check-deployment');
(async () => {
    validate(process.env);
    const db = require('knex')(require('../knexfile'));
    try {
        const [, migrations] = await db.migrate.latest();
        console.log('Deployment database ready. Migrations applied: ' + migrations.length);
    } finally { await db.destroy(); }
})().catch(error => {
    // Configuration diagnostics contain variable names only; DB errors may contain credentials.
    console.error(error.message.startsWith('Deployment configuration invalid:') ? error.message : 'Deployment migration failed (' + (error.code || error.name) + '). Check database availability, mini_hrms schema and migration permissions.');
    process.exitCode = 1;
});
