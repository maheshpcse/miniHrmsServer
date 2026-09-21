'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');
exports.up = async function(knex) {
  await assertDatabaseTarget(knex);
  await knex.schema.createTable('portal_user_preferences', table => {
    table.integer('userId').unsigned().primary();
    table.bigInteger('notificationsReadThrough').unsigned().notNullable().defaultTo(0);
  });
};
exports.down = async function(knex) { await assertDatabaseTarget(knex); await knex.schema.dropTableIfExists('portal_user_preferences'); };
