'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');
exports.up = async (db) => {
  await assertDatabaseTarget(db);
  if (await db.schema.hasTable('notification_delivery')) return;
  await db.schema.createTable('notification_delivery', (t) => {
    t.bigIncrements('id');
    t.integer('notification_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('portal_notifications');
    t.integer('employee_id')
      .notNullable()
      .references('userId')
      .inTable('employees');
    t.string('channel', 10).notNullable();
    t.string('status', 20).notNullable().defaultTo('queued');
    t.integer('attempts').notNullable().defaultTo(0);
    t.string('provider_id', 100);
    t.string('error_code', 40);
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').defaultTo(db.fn.now());
    t.unique(['notification_id', 'employee_id', 'channel']);
    t.index(['status', 'id']);
  });
};
exports.down = async () => {
  throw new Error('Use a forward migration to preserve delivery history.');
};
