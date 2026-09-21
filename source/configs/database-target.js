'use strict';
function databaseName(env = process.env) {
  const expected = env.NODE_ENV === 'production' ? 'railway' : 'mini_hrms';
  if (env.DB_NAME && env.DB_NAME !== expected) throw new Error('DB_NAME must be ' + expected + ' for ' + (env.NODE_ENV === 'production' ? 'production' : 'local development') + '.');
  return expected;
}
async function assertDatabaseTarget(knex, env = process.env) {
  const expected = databaseName(env);
  const [rows] = await knex.raw('SELECT DATABASE() AS name');
  if (!rows[0] || rows[0].name !== expected) throw new Error('Migration connection must target ' + expected + '.');
}
module.exports = { databaseName, assertDatabaseTarget };
