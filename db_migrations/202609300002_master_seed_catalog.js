'use strict';
const {assertDatabaseTarget}=require('../source/configs/database-target');
exports.config={transaction:false};
exports.up=async db=>{
 await assertDatabaseTarget(db);
 if(!await db.schema.hasTable('hrms_master_category'))await db.schema.createTable('hrms_master_category',t=>{t.string('code',64).primary();t.string('name',150).notNullable();});
 if(!await db.schema.hasTable('hrms_master_value'))await db.schema.createTable('hrms_master_value',t=>{
  t.bigIncrements('id');t.string('category_code',64).notNullable().references('code').inTable('hrms_master_category');t.string('code',80).notNullable();t.string('scope_key',80).notNullable();
  t.bigInteger('organization_id').unsigned().nullable().references('id').inTable('org_entity');t.string('name',150).notNullable();t.string('state',20).notNullable().defaultTo('template');t.json('config').notNullable();
  t.date('effective_from');t.date('effective_to');t.integer('version').notNullable().defaultTo(1);t.integer('created_by').nullable().references('userId').inTable('employees');t.integer('updated_by').nullable().references('userId').inTable('employees');
  t.timestamp('created_at').notNullable().defaultTo(db.fn.now());t.timestamp('updated_at').nullable();t.string('source_pack',150).notNullable();t.unique(['scope_key','category_code','code']);t.index(['organization_id','category_code','state']);
 });
 await require('../database/seeds').apply(db);
};
exports.down=async()=>{throw Error('Master data is forward-only; deactivate or end-date referenced values.');};
