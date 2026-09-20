'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Knex = require('knex');
const tables = require('../schema/tables.json');
const routines = require('../schema/routines.json');
const migration = require('../../db_migrations/202609190001_reconcile_mini_hrms_tables');
const routineMigration = require('../../db_migrations/202609190002_install_missing_mini_hrms_routines');
const dataDir = process.env.MINI_HRMS_TEST_DATADIR;
if (!dataDir || !path.basename(dataDir).startsWith('minihrms-migration-test-')) throw new Error('An isolated test datadir is required.');
const connection = { host:'127.0.0.1', port:17360, user:'root', password:'', charset:'utf8mb4', multipleStatements:false };
const admin = Knex({client:'mysql',connection,pool:{min:0,max:1}});
let db;
const normalize = s => path.resolve(s).toLowerCase().replace(/\\/g,'/').replace(/\/$/,'');
async function reset() {
  if(db) await db.destroy();
  await admin.raw('DROP DATABASE IF EXISTS mini_hrms');
  await admin.raw('CREATE DATABASE mini_hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  db=Knex({client:'mysql',connection:{...connection,database:'mini_hrms'},pool:{min:0,max:1},migrations:{directory:path.resolve(__dirname,'../../db_migrations')}});
}
async function seed(typo=false) {
  await db('employees').insert({empId:'TEST001',[typo?'fisrtName':'firstName']:'Test',lastName:'Employee',userName:'test.employee',email:'test@example.invalid',createdBy:1});
}
async function assertFinal() {
  const [rows]=await db.raw('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  for(const t of tables) assert(rows.some(r=>r.TABLE_NAME===t.name),t.name);
  const [columns]=await db.raw("SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='employee_onboarding_details' AND COLUMN_NAME='approvedBy'");
  assert.strictEqual(columns[0].COLUMN_TYPE,'varchar(50)'); assert.strictEqual(columns[0].COLUMN_DEFAULT,null); assert.strictEqual(columns[0].IS_NULLABLE,'YES');
  assert(await db.schema.hasColumn('employees','firstName'));
  assert(!(await db.schema.hasColumn('employees','fisrtName')));
  assert(await db.schema.hasColumn('employee_bank_details','personalBanksInfo'));
  for(const table of ['employee_attendance_details','audit_employee_attendance']) {
    const [indexes]=await db.raw('SHOW INDEX FROM ??',[table]);
    assert(!indexes.some(i=>i.Column_name==='empId' && i.Non_unique===0));
  }
}
async function checkRoutines() {
  const [actual]=await db.raw('SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()');
  assert.strictEqual(actual.length,routines.length);
  await seed();
  await db('employee_basic_details').insert({empId:'TEST001',createdBy:1});
  await db('employee_onboarding_details').insert({employeeInfo:JSON.stringify({empId:'TEST001'}),onBoardStartDate:'2026-09-19',createdBy:1});
  const [detail]=await db.raw("CALL get_employee_data_by_id('TEST001')");
  const employee=JSON.parse(detail[0][0].employeeData);
  assert.strictEqual(employee.employeeInfo.empId,'TEST001'); assert.deepStrictEqual(employee.empProcessInfo,[]);
  assert.strictEqual(employee.empOnboardingInfo.approvedBy,null);
  for(const proc of ['get_all_employees_data','get_login_history_data','get_login_encrypt_data']) await db.raw('CALL '+proc+'(10,1)');
  await db.raw("CALL get_employee_process_data_by_id('TEST001', @result)");
  await db.raw("CALL save_login_encrypt_data(NULL,1,'synthetic-test-key','AES',1)");
  await db.raw("CALL update_login_encrypt_data_status(1,0)");
  assert.strictEqual((await db('login_encrypt_details').first()).status,0);
  const args=[null,'ADMIN_TEST','Test','Admin','test.admin','admin@example.invalid',null,null,'admin',1,1,'2026-09-19 00:00:00',null,null,'synthetic-hash','synthetic-settings-hash',0,null,JSON.stringify({LoginPasswordExpiryDate:'2020-01-01 00:00:00'})];
  await db.raw('CALL add_default_admin_login_data('+args.map(()=>'?').join(',')+')',args);
  assert.strictEqual(Number((await db('employees').count('* as count'))[0].count),2,'bootstrap must not truncate existing employees');
  await assert.rejects(db.raw('CALL add_default_admin_login_data('+args.map(()=>'?').join(',')+')',args));
  assert.strictEqual(Number((await db('employees').count('* as count'))[0].count),2);
  await db.raw("CALL get_admin_login('test.admin')");
  await db.raw("CALL get_validate_admin_email('admin@example.invalid')");
  await db.raw("CALL update_admin_password('admin@example.invalid','updated-synthetic-hash')");
  const adminRow=await db('admin_login').first();
  assert.strictEqual(adminRow.adminPassword,'updated-synthetic-hash');
  assert(new Date(JSON.parse(adminRow.passwordsInfo).LoginPasswordExpiryDate)>new Date());
  const [audit]=await db.raw("CALL save_audit_employee_admin_login('ADMIN_TEST',1,NULL,NULL,NULL,'127.0.0.1')");
  await db.raw('CALL get_admin_and_settings_logout(?,?)',[adminRow.adminLoginId,audit[0][0].audit_login_id]);
  for(let i=0;i<2;i++) {
    await db('employee_attendance_details').insert({empId:'TEST001',loginTime:'2026-09-19 09:00:00',logoutTime:'2026-09-19 17:00:00',loginCode:'DA',loginType:'Online'});
    await db('audit_employee_attendance').insert({empId:'TEST001',outTime:'2026-09-19 12:00:00',inTime:'2026-09-19 12:30:00',sessionTime:'00:30:00',loginType:'Online',awayReason:'Test'});
  }
  assert.strictEqual(Number((await db('employee_attendance_details').count('* as count'))[0].count),2);
}
(async()=>{
  const [instance]=await admin.raw('SELECT @@datadir AS dir, @@port AS port');
  assert.strictEqual(normalize(instance[0].dir),normalize(dataDir),'Refusing to reset a non-test instance');
  assert.strictEqual(instance[0].port,17360);
  await reset();
  await db.migrate.latest(); await assertFinal(); await checkRoutines();
  assert.deepStrictEqual((await db.migrate.latest())[1],[]);
  await migration.up(db); await routineMigration.up(db);
  console.log('PASS: fresh install, all 14 routines, API response shape, attendance history, repeat run, bootstrap preservation');
  const sourceDir=process.env.MINI_HRMS_SOURCE_DIR;
  if(sourceDir) for(const file of ['MiNi HRMS_New.sql','mini_hrms (1).sql','mini_hrms.sql']) {
    await reset();
    const sql=fs.readFileSync(path.join(sourceDir,file),'utf8').replace(/\r/g,'');
    const creates=[...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`[\s\S]*?;/g)].map(m=>({name:m[1],sql:m[0]}));
    creates.sort((a,b)=>a.name==='employees'?-1:b.name==='employees'?1:0);
    for(const t of creates) await db.raw(t.sql);
    for(const m of sql.matchAll(/^ALTER TABLE[^;]+;/gm)) await db.raw(m[0]);
    const typo=await db.schema.hasColumn('employees','fisrtName'); await seed(typo);
    await db('employee_basic_details').insert({empId:'TEST001',createdBy:1});
    await db('employee_onboarding_details').insert({employeeInfo:JSON.stringify({empId:'TEST001'}),onBoardStartDate:'2026-09-19',approvedBy:'TEST001',createdBy:1});
    await db.raw('CREATE PROCEDURE get_admin_login(IN loginName varchar(100)) SELECT 123 AS preserved');
    await db.migrate.latest(); await assertFinal(); await migration.up(db);
    assert.strictEqual((await db('employee_onboarding_details').first()).approvedBy,'TEST001');
    assert.strictEqual((await db('employees').first()).firstName,'Test');
    assert.strictEqual((await db('employee_basic_details').first()).empId,'TEST001');
    const [preserved]=await db.raw("CALL get_admin_login('anything')"); assert.strictEqual(preserved[0][0].preserved,123);
    console.log('PASS: data-preserving upgrade from '+file+'; existing routines preserved');
  }
  await reset(); await db.raw(tables[0].sql);
  await db.schema.table('employees',t=>t.string('unexpectedField'));
  await assert.rejects(migration.up(db),/Unexpected column/);
  assert(!(await db.schema.hasTable('admin_login')));
  console.log('PASS: unknown schema drift rejected before creating application tables');
  await reset(); await migration.up(db); await seed();
  await db.raw('SET FOREIGN_KEY_CHECKS=0');
  await db('employee_basic_details').insert({empId:'MISSING',createdBy:1});
  await db.raw('SET FOREIGN_KEY_CHECKS=1');
  await assert.rejects(migration.up(db),/Orphan reference/);
  await assert.rejects(migration.down(db),/Forward-only/);
  console.log('PASS: orphan preflight and destructive rollback refusal');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(db)await db.destroy();await admin.destroy();});
