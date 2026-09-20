require('dotenv').config();
const Knex = require('knex');
const knexConfig = require('./knex.config.js');
// Schema changes are managed by the Knex CLI. The unused legacy database
// manager supports only the old mysql driver and must not block mysql2 startup.
module.exports = { config: { knex: knexConfig }, knex: Knex(knexConfig) };
