'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');
exports.config = { transaction: false };
exports.up = async (db) => {
  await assertDatabaseTarget(db);
  const create = async (name, fn) => {
    if (!(await db.schema.hasTable(name)))
      await db.schema.createTable(name, (t) => {
        t.bigIncrements('id');
        fn(t);
      });
  };
  const employee = (t, name) =>
    t.integer(name).notNullable().references('userId').inTable('employees');
  const ref = (t, name, table) =>
    t.bigInteger(name).unsigned().notNullable().references('id').inTable(table);
  await create('chat_room', (t) => {
    t.string('title', 120).notNullable();
    t.string('kind', 12).notNullable();
    t.string('direct_key', 60).unique();
    employee(t, 'created_by');
    t.bigInteger('last_message_id').unsigned().defaultTo(0);
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').defaultTo(db.fn.now());
  });
  await create('chat_member', (t) => {
    ref(t, 'room_id', 'chat_room');
    employee(t, 'employee_id');
    t.bigInteger('last_read_id').unsigned().notNullable().defaultTo(0);
    t.unique(['room_id', 'employee_id']);
    t.index(['employee_id', 'room_id']);
  });
  await create('chat_message', (t) => {
    ref(t, 'room_id', 'chat_room');
    employee(t, 'sender_id');
    t.string('client_nonce', 80).notNullable();
    t.text('body').notNullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.unique(['room_id', 'sender_id', 'client_nonce']);
    t.index(['room_id', 'id']);
  });
  await create('push_subscription', (t) => {
    employee(t, 'employee_id');
    t.string('endpoint_hash', 64).notNullable().unique();
    t.text('endpoint').notNullable();
    t.string('p256dh', 120).notNullable();
    t.string('auth', 50).notNullable();
    t.boolean('active').defaultTo(true);
    t.bigInteger('last_notification_id').unsigned().defaultTo(0);
    t.timestamp('last_scan_at').nullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.index(['employee_id', 'active']);
  });
  await create('push_delivery', (t) => {
    ref(t, 'subscription_id', 'push_subscription');
    employee(t, 'employee_id');
    t.integer('notification_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('portal_notifications');
    t.string('status', 20).defaultTo('queued');
    t.timestamp('updated_at').defaultTo(db.fn.now());
    t.unique(['subscription_id', 'notification_id']);
    t.index(['status', 'id']);
  });
  await create('pay_tax_policy', (t) => {
    t.string('name', 150).notNullable();
    t.string('country', 2).notNullable();
    t.string('region', 80).notNullable();
    t.string('tax_year', 20).notNullable();
    t.string('currency', 3).notNullable();
    t.date('effective_from').notNullable();
    t.date('effective_to').notNullable();
    t.json('rules').notNullable();
    t.string('status', 16).notNullable().defaultTo('draft');
    t.text('source_reference').notNullable();
    employee(t, 'created_by');
    t.integer('activated_by');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });
  await create('pay_compensation', (t) => {
    employee(t, 'employee_id');
    ref(t, 'tax_policy_id', 'pay_tax_policy');
    t.string('currency', 3).notNullable();
    t.date('effective_from').notNullable();
    t.json('components').notNullable();
    employee(t, 'created_by');
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.index(['employee_id', 'effective_from']);
  });
  await create('pay_run', (t) => {
    t.string('period', 7).notNullable();
    t.string('status', 20).notNullable().defaultTo('draft');
    ref(t, 'compensation_id', 'pay_compensation');
    employee(t, 'employee_id');
    t.json('input_snapshot').notNullable();
    t.json('result').notNullable();
    t.string('checksum', 64).notNullable();
    employee(t, 'created_by');
    t.integer('reviewed_by');
    t.bigInteger('result_id').unsigned();
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('finalized_at');
    t.index(['employee_id', 'period']);
  });
};
exports.down = async () => {
  throw new Error(
    'Forward migrations only: preserve payroll and communication history.'
  );
};
