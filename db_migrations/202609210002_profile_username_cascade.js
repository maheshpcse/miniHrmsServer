'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');
exports.config = {transaction:false};
exports.up = async function(db) {
  await assertDatabaseTarget(db);
  const [keys] = await db.raw("SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME='employees' AND k.REFERENCED_COLUMN_NAME='userName'");
  for (const key of keys) {
    if (!['admin_login','employee_login'].includes(key.TABLE_NAME) || key.UPDATE_RULE==='CASCADE') continue;
    if (!['RESTRICT','NO ACTION','CASCADE','SET NULL'].includes(key.DELETE_RULE)) throw new Error('Unexpected username foreign-key delete rule.');
    await db.raw('ALTER TABLE ?? DROP FOREIGN KEY ??, ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES employees (userName) ON UPDATE CASCADE ON DELETE '+key.DELETE_RULE,[key.TABLE_NAME,key.CONSTRAINT_NAME,key.TABLE_NAME+'_username_cascade_fk',key.COLUMN_NAME]);
  }
};
exports.down = async function() { throw new Error('Username synchronization is forward-only; review dependent login data before reverting.'); };
