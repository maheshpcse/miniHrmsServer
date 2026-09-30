'use strict';
const bcrypt=require('bcrypt');
const users=[
 {empId:'DEMO_HR',userName:'demo.hr',firstName:'Harper',lastName:'Reed',roleName:'hr',department:'Human Resources',designation:'HR Manager'},
 {empId:'DEMO_MANAGER',userName:'demo.manager',firstName:'Morgan',lastName:'Lee',roleName:'rm',department:'Engineering',designation:'Team Lead'},
 {empId:'DEMO_EMPLOYEE',userName:'demo.employee',firstName:'Alex',lastName:'Taylor',roleName:'employee',department:'Engineering',designation:'Software Engineer'},
 {empId:'DEMO_EMPLOYEE_2',userName:'demo.employee2',firstName:'Jordan',lastName:'Rivera',roleName:'employee',department:'Engineering',designation:'Quality Engineer'}
];
exports.seed=async(db,{organizationId,password})=>{
 if(typeof password!=='string'||password.length<14||Buffer.byteLength(password)>72)throw Error('Provide a demo password of 14-72 UTF-8 bytes.');
 if(!Number.isInteger(Number(organizationId))||Number(organizationId)<1)throw Error('Choose an existing demo organization explicitly.');
 return db.transaction(async trx=>{
  const organization=await trx('org_entity').where({id:organizationId}).forUpdate().first();if(!organization)throw Error('Demo organization not found.');
  const result=[];
  for(const u of users){
   const found=await trx('employees').where({empId:u.empId}).orWhere({userName:u.userName}).orWhere({email:u.userName+'@example.invalid'}).first();
   if(found){let profile=found.profile;try{if(typeof profile==='string')profile=JSON.parse(profile);}catch{profile=null;}
    if(found.empId!==u.empId||found.userName!==u.userName||!profile||profile.seed_pack!=='hrms-local-demo-v1')throw Error('A demo identifier belongs to an existing non-demo account; nothing changed.');
    const assignment=await trx('emp_job_assignment').where({employee_id:found.userId}).orderBy('effective_from','desc').first();if(!assignment||Number(assignment.organization_id)!==Number(organizationId))throw Error('Demo account belongs to a different organization.');
    result.push({id:found.userId,username:u.userName,created:false});continue;
   }
   const role=await trx('portal_catalog').where({kind:'roles',code:u.roleName,status:1}).first();if(!role)throw Error('Required demo role is not active.');
   const {department,designation,...employee}=u;
   const [id]=await trx('employees').insert({...employee,email:u.userName+'@example.invalid',status:1,createdBy:0,profile:JSON.stringify({seed_pack:'hrms-local-demo-v1',deliveryPreferences:{email:false,sms:false}})});
   await trx('employees').where({userId:id}).update({createdBy:id});
   await trx('employee_login').insert({empId:u.empId,empLoginName:u.userName,empPassword:await bcrypt.hash(password,12),loginStatus:0,createdBy:id,passwordUpdatedOn:trx.fn.now()});
   const manager=result.find(x=>x.username==='demo.manager');
   await trx('emp_job_assignment').insert({employee_id:id,organization_id:organizationId,manager_id:u.roleName==='employee'&&manager?manager.id:null,department,designation,location:'Demo workspace',employment_type:'Full time',effective_from:'2026-01-01',created_by:id});
   await trx('emp_onboarding_task').insert({employee_id:id,area:'HR',title:'Explore your demo workspace',status:'pending',created_by:id});
   await trx('audit_log').insert({actor_id:id,module:'people',action:'demo_account_seeded',entity_id:id,metadata:JSON.stringify({pack:'hrms-local-demo-v1',synthetic:true})});
   result.push({id,username:u.userName,created:true});
  }
  for(const [kind,name] of [['department','Human Resources'],['department','Engineering'],['location','Demo workspace']])if(!await trx('org_unit').where({organization_id:organizationId,kind,name}).first())await trx('org_unit').insert({organization_id:organizationId,kind,name});
  return result;
 });
};
exports.assertLocal=async(db,env=process.env)=>{
 if(env.NODE_ENV==='production'||env.DEMO_SEED_ENABLED!=='true')throw Error('Demo seeding requires explicit local opt-in and is blocked in production.');
 const connection=db.client.config.connection;
 if(!['127.0.0.1','localhost','::1'].includes(connection.host)||connection.database!=='mini_hrms')throw Error('Demo seeding is restricted to local mini_hrms.');
 const [rows]=await db.raw('SELECT DATABASE() AS name');if(rows[0].name!=='mini_hrms')throw Error('Wrong demo database.');
};
if(require.main===module){const db=require('knex')(require('../knexfile'));
 (async()=>{await exports.assertLocal(db);const rows=await exports.seed(db,{organizationId:Number(process.env.DEMO_ORGANIZATION_ID),password:process.env.DEMO_PASSWORD});console.log(JSON.stringify({accounts:rows,message:'Use the regular sign-in form. Existing demo passwords and profiles were preserved; no external messages sent.'}));})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.destroy());}
