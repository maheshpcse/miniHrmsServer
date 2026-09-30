'use strict';
const assert=require('assert'),seeds=require('../database/seeds'),demo=require('../scripts/seed-demo');
module.exports=async({db,request})=>{
 const count=()=>db('hrms_master_value').count('* as n').first().then(r=>Number(r.n));
 const before=await count();assert(before>=200);assert.equal(seeds.files.length,8);
 await db('hrms_master_value').where({category_code:'DEPARTMENT',code:'ENGINEERING',scope_key:'SYSTEM'}).update({name:'Preserved custom name'});
 await seeds.apply(db);assert.equal(await count(),before);assert.equal((await db('hrms_master_value').where({category_code:'DEPARTMENT',code:'ENGINEERING'}).first()).name,'Preserved custom name');
 assert.equal(await db('hrms_master_value').where({category_code:'LEAVE_TYPE',state:'active'}).first(),undefined);
 await assert.rejects(()=>demo.assertLocal(db,{NODE_ENV:'production',DEMO_SEED_ENABLED:'true'}),/production/);
 await assert.rejects(()=>demo.assertLocal(db,{NODE_ENV:'development'}),/opt-in/);
 const org=await db('org_entity').orderBy('id').first();const opts={organizationId:org.id,password:'Synthetic-Demo-Only-123!'};
 const created=await demo.seed(db,opts);assert(created.every(r=>r.created));const hash=(await db('employee_login').where({empId:'DEMO_EMPLOYEE'}).first()).empPassword;
 assert((await demo.seed(db,{...opts,password:'Different-Demo-Only-123!'})).every(r=>!r.created));assert.equal((await db('employee_login').where({empId:'DEMO_EMPLOYEE'}).first()).empPassword,hash);
 await db('portal_rate_limits').del();const tokens={};
 for(const user of created){const login=await request('/auth/login','POST',{username:user.username,password:opts.password});assert.equal(login.status,200,login.message);tokens[user.username]=login.data.token;assert.equal((await request('/me','GET',null,login.data.token)).status,200);}
 const hr=tokens['demo.hr'],employee=tokens['demo.employee'],manager=tokens['demo.manager'];
 assert.equal((await request('/core/masters','GET',null,hr)).data.count,before);assert.equal((await request('/core/masters','GET',null,employee)).status,403);
 assert.equal((await request('/resources/employees','GET',null,hr)).status,200);assert.equal((await request('/resources/employees','GET',null,employee)).status,403);
 assert.equal((await request('/core/payroll/settings','GET',null,hr)).status,403);assert.equal((await request('/core/payroll/settings','GET',null,employee)).status,403);
 const context=(await request('/core/context','GET',null,manager)).data;assert(context.teamIds.includes(created.find(r=>r.username==='demo.employee').id));assert(!context.teamIds.includes(created.find(r=>r.username==='demo.hr').id));
 const punch={event_type:'IN',correlation_id:'demo-seed-integration-punch'};assert.equal((await request('/core/attendance/punch','POST',punch,employee)).status,200);assert.equal((await request('/core/attendance/punch','POST',punch,employee)).status,200);
 assert.equal(Number((await db('att_punch_event').where({correlation_id:punch.correlation_id}).count('* as n').first()).n),1);
 const room=await request('/core/chat/rooms','POST',{members:[created.find(r=>r.username==='demo.hr').id]},employee);assert.equal(room.status,200,room.message);
 assert.equal((await request('/core/chat/rooms/'+room.data.id+'/messages','POST',{body:'Demo employee contacting HR',client_nonce:'demo-seed-test'},employee)).status,200);
 assert.equal((await request('/core/chat/rooms/'+room.data.id+'/messages','GET',null,hr)).status,200);
 console.log('PASS: eight master seed packs, repeatability/customization preservation, production demo guard, four demo logins, HR/self/team authorization, persisted punch and HR chat.');
};
