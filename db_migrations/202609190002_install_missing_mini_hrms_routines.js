'use strict';
const routines = require('../database/schema/routines.json');
exports.config = { transaction: false };
exports.up = async function (knex) {
    const [database] = await knex.raw('SELECT DATABASE() AS name');
    if (database[0].name !== 'mini_hrms') throw new Error('This migration must target mini_hrms.');
    const [existing] = await knex.raw('SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()');
    for (const routine of routines) {
        if (!existing.some(r => r.ROUTINE_NAME === routine.name && r.ROUTINE_TYPE === routine.type)) {
            await knex.raw(routine.sql);
        }
    }
};
exports.down = async function () {
    throw new Error('Forward-only routine installation: existing application routines must not be dropped automatically.');
};
