'use strict';
const express=require('express');
const crypto=require('crypto');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const parse=(value,fallback={})=>{if(value===null||value===undefined)return fallback;if(typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;}};
const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const text=(value,name,max=150,required=true)=>{if(value===undefined||value===null){if(!required)return null;fail(400,name+' is required.');}if(typeof value!=='string'&&typeof value!=='number')fail(400,name+' is invalid.');const result=String(value).trim();if((required&&!result)||result.length>max)fail(400,name+' must contain '+(required?'1':'0')+'–'+max+' characters.');return result||null;};
const email=value=>{const result=text(value,'Email',100).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))fail(400,'Enter a valid email address.');return result;};
const password=value=>{if(typeof value!=='string'||value.length<10||Buffer.byteLength(value,'utf8')>72)fail(400,'Use a password of at least 10 characters and no more than 72 UTF-8 bytes.');return value;};
const integer=(value,name,min,max)=>{const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)fail(400,name+' is invalid.');return number;};
const date=(value,name)=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||isNaN(new Date(value+'T00:00:00Z').getTime())||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(400,name+' is invalid.');return value;};
module.exports=function createPortal({db,secret,mailer}){
 if(!secret)throw new Error('SECURITY_KEY must be configured for the portal.');
 const router=express.Router();
 const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
 const ok=(res,data,message='Success')=>res.json({success:true,data,message});
 const hash=value=>crypto.createHmac('sha256',secret).update(value).digest('hex');
 const permissionCodes=['employees:read','employees:write','settings:write','requests:review','notifications:write'];
 const permitted=(req,permission)=>req.user.roleName==='admin'||req.permissions.includes(permission);
 const requirePermission=(req,permission)=>{if(!permitted(req,permission))fail(403,'You do not have permission to perform this action.');};
 async function permissions(role){if(role==='admin')return permissionCodes;const record=await db('portal_catalog').where({kind:'roles',code:role,status:1}).first();return record?String(parse(record.payload).permissions||'').split(',').map(p=>p.trim()).filter(p=>permissionCodes.includes(p)):[];}
 async function throttle(req,scope,max=10){const id=hash(scope+':'+req.ip);await db.raw('INSERT INTO portal_rate_limits (id,hits,windowEnds) VALUES (?,1,DATE_ADD(NOW(),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE hits=IF(windowEnds<NOW(),1,hits+1), windowEnds=IF(windowEnds<NOW(),DATE_ADD(NOW(),INTERVAL 15 MINUTE),windowEnds)',[id]);const row=await db('portal_rate_limits').where({id}).first();if(row.hits>max)fail(429,'Too many attempts. Please try again in 15 minutes.');}
 const authenticate=asyncRoute(async(req,res,next)=>{
  const header=req.get('authorization')||'';const token=header.replace(/^Bearer\s+/i,'').split(',')[0];let claims;
  try{claims=jwt.verify(token,secret,{algorithms:['HS256']});}catch{fail(401,'Your session has expired. Please sign in again.');}
  if(!claims.sid)fail(401,'Please sign in again to start a secure workspace session.');
  const session=await db('portal_sessions').where({id:claims.sid}).whereNull('revokedAt').where('expiresAt','>',new Date()).first();
  if(!session)fail(401,'Your session has expired. Please sign in again.');
  const user=await db('employees').where({userId:session.userId,status:1}).first();if(!user)fail(401,'This account is not active. Contact your HR team.');
  const role=await db('portal_catalog').where({kind:'roles',code:user.roleName,status:1}).first();if(!role)fail(403,'Your workspace role is not active. Contact your administrator.');
  req.user=user;req.session=session;req.permissions=await permissions(user.roleName);next();
 });
 const login=asyncRoute(async(req,res)=>{
  await throttle(req,'login');const username=text(req.body.adminLoginName||req.body.username,'Username',100);const supplied=req.body.adminPassword||req.body.password;if(typeof supplied!=='string'||Buffer.byteLength(supplied)>1024)fail(400,'Enter your password.');
  const user=await db('employees').where(function(){this.where('userName',username).orWhere('empId',username).orWhere('email',username);}).first();
  let credential=user?await db('admin_login').where({empId:user.empId}).first():null;let kind='admin';
  if(!credential&&user){credential=await db('employee_login').where({empId:user.empId}).first();kind='employee';}
  if(!credential||!(await bcrypt.compare(supplied,kind==='admin'?credential.adminPassword:credential.empPassword)))fail(401,'The username or password is incorrect.');
  if(user.status!==1)fail(403,'Your account is awaiting approval or is inactive. Contact your HR team.');
  const role=await db('portal_catalog').where({kind:'roles',code:user.roleName,status:1}).first();if(!role)fail(403,'Your workspace role is inactive.');
  const expiry=kind==='admin'?parse(credential.passwordsInfo).LoginPasswordExpiryDate:credential.passwordExpiryDate;
  if(expiry&&new Date(expiry)<new Date())fail(403,'Your password has expired. Use Forgot password to set a new one.');
  const sid=crypto.randomBytes(24).toString('hex');const expiresAt=new Date(Date.now()+3600000);let auditId;
  await db.transaction(async trx=>{const [id]=await trx('audit_employee_admin_login').insert({empId:user.empId,loginType:1,lastLoginTime:trx.fn.now(),ipAddress:req.ip,status:1});auditId=id;await trx('portal_sessions').insert({id:sid,userId:user.userId,loginKind:kind,auditId,expiresAt});await trx(kind==='admin'?'admin_login':'employee_login').where({empId:user.empId}).update({loginStatus:1,lastLoginTime:trx.fn.now()});});
  const token=jwt.sign({sid,userId:user.userId,empId:user.empId,role:user.roleName},secret,{algorithm:'HS256',expiresIn:'1h'});
  ok(res,{token,userId:user.userId,empId:user.empId,firstName:user.firstName,lastName:user.lastName,userName:user.userName,email:user.email,role:user.roleName,permissions:await permissions(user.roleName),auditLoginId:auditId,expired:expiresAt.toISOString()},'Welcome back.');
 });
 const signup=asyncRoute(async(req,res)=>{
  await throttle(req,'signup',5);const firstName=text(req.body.firstName,'First name',50),lastName=text(req.body.lastName,'Last name',50,false),mail=email(req.body.email),username=text(req.body.userName,'Username',50);const encrypted=await bcrypt.hash(password(req.body.password),12);
  const empId='EMP'+crypto.randomBytes(6).toString('hex').toUpperCase();
  await db.transaction(async trx=>{const [userId]=await trx('employees').insert({empId,firstName,lastName,userName:username,email:mail,roleName:'employee',status:2,createdBy:0});await trx('employees').where({userId}).update({createdBy:userId});await trx('employee_login').insert({empId,empLoginName:username,empPassword:encrypted,loginStatus:0,createdBy:userId,passwordUpdatedOn:trx.fn.now()});await trx('portal_requests').insert({userId,name:'Workspace access · '+firstName,kind:'access',description:'New employee account awaiting HR approval.',status:'pending'});});
  ok(res,{pending:true},'Your employee account is awaiting HR approval.');
 });
 const forgot=asyncRoute(async(req,res)=>{
  await throttle(req,'forgot',5);const mail=email(req.body.adminEmail||req.body.email);const user=await db('employees').where({email:mail,status:1}).first();const id=crypto.randomBytes(24).toString('hex');const code=String(crypto.randomInt(100000,1000000));
  if(user&&!mailer)fail(503,'Password recovery email is not configured. Please contact your administrator.');
  await db('portal_password_resets').insert({id,userId:user?user.userId:null,codeHash:hash(id+':'+code),expiresAt:new Date(Date.now()+600000)});
  if(user){try{await mailer({to:mail,subject:'Your MiNi HRMS verification code',text:'Your verification code is '+code+'. It expires in 10 minutes. If you did not request a password reset, ignore this email.'});}catch{await db('portal_password_resets').where({id}).update({consumedAt:db.fn.now()});fail(503,'We could not deliver the verification email. Please try again later.');}}
  ok(res,{challenge:id},'If an active account matches, a verification code has been sent.');
 });
 const reset=asyncRoute(async(req,res)=>{
  await throttle(req,'reset',10);const id=text(req.body.challenge,'Recovery request',64);const code=text(req.body.code,'Verification code',6);if(!/^\d{6}$/.test(code))fail(400,'Enter the six-digit verification code.');const encrypted=await bcrypt.hash(password(req.body.password),12);
  const result=await db.transaction(async trx=>{const record=await trx('portal_password_resets').where({id}).forUpdate().first();if(!record||record.consumedAt||new Date(record.expiresAt)<new Date()||record.attempts>=5)return false;
   await trx('portal_password_resets').where({id}).increment('attempts',1);if(!record.userId||!crypto.timingSafeEqual(Buffer.from(record.codeHash,'hex'),Buffer.from(hash(id+':'+code),'hex')))return false;
   const user=await trx('employees').where({userId:record.userId,status:1}).first();if(!user)return false;
   await trx('employee_login').where({empId:user.empId}).update({empPassword:encrypted,passwordUpdatedOn:trx.fn.now(),passwordExpiryDate:null,loginStatus:0});
   const admin=await trx('admin_login').where({empId:user.empId}).first();if(admin){const info=parse(admin.passwordsInfo);info.LoginPasswordUpdatedOn=new Date().toISOString();info.LoginPasswordExpiryDate=new Date(Date.now()+90*86400000).toISOString();await trx('admin_login').where({empId:user.empId}).update({adminPassword:encrypted,passwordsInfo:JSON.stringify(info),loginStatus:0});}
   await trx('portal_password_resets').where({userId:user.userId}).whereNull('consumedAt').update({consumedAt:trx.fn.now()});await trx('portal_sessions').where({userId:user.userId}).whereNull('revokedAt').update({revokedAt:trx.fn.now()});return true;
  });if(!result)fail(400,'The verification code is invalid or expired. Request a new code.');ok(res,{updated:true},'Password updated.');
 });
 router.post('/auth/login',login);router.post('/auth/signup',signup);router.post('/auth/forgot',forgot);router.post('/auth/reset',reset);
 router.use(authenticate);
 const logout=asyncRoute(async(req,res)=>{await db.transaction(async trx=>{await trx('portal_sessions').where({id:req.session.id}).update({revokedAt:trx.fn.now()});if(req.session.auditId)await trx('audit_employee_admin_login').where({auditEmpAdminLoginId:req.session.auditId}).update({lastLogoutTime:trx.fn.now(),sessionTime:trx.raw('SEC_TO_TIME(GREATEST(0,TIMESTAMPDIFF(SECOND,lastLoginTime,NOW())))')});const active=await trx('portal_sessions').where({userId:req.user.userId,loginKind:req.session.loginKind}).whereNull('revokedAt').where('expiresAt','>',new Date()).first();if(!active)await trx(req.session.loginKind==='admin'?'admin_login':'employee_login').where({empId:req.user.empId}).update({loginStatus:0});});ok(res,{signedOut:true});});router.post('/auth/logout',logout);
 router.get('/dashboard',asyncRoute(async(req,res)=>{
  const team=permitted(req,'employees:read');const peopleQuery=db('employees');if(!team)peopleQuery.where({userId:req.user.userId});
  const [people]=await peopleQuery.clone().count('* as count');const [active]=await peopleQuery.clone().where({status:1}).count('* as count');const requestsQuery=db('portal_requests').where({status:'pending'});if(!permitted(req,'requests:review'))requestsQuery.where({userId:req.user.userId});const [requests]=await requestsQuery.count('* as count');const [inactive]=await peopleQuery.clone().where({status:0}).count('* as count');
  const recent=await peopleQuery.clone().select('empId','firstName','lastName','roleName','status').orderBy('createdAt','desc').limit(5);const roles=await peopleQuery.clone().select('roleName').count('* as count').groupBy('roleName');ok(res,{people:Number(people.count),active:Number(active.count),requests:Number(requests.count),inactive:Number(inactive.count),recent,roles});
 }));
 const catalogKinds=['menus','roles','permissions','leave-types'];
 async function resource(req){const kind=req.params.kind;let table,pk='id',columns,search,query;
  if(kind==='employees'){requirePermission(req,'employees:read');table='employees';pk='userId';columns=['userId','empId','firstName','lastName','userName','email','roleName','status','createdAt'];search=['firstName','lastName','email','empId','userName'];}
  else if(kind==='login-history'){requirePermission(req,'employees:read');table='audit_employee_admin_login';pk='auditEmpAdminLoginId';columns=['auditEmpAdminLoginId','empId','lastLoginTime','lastLogoutTime','sessionTime','ipAddress','status','createdAt'];search=['empId','ipAddress'];}
  else if(kind==='attendance-types'){requirePermission(req,'settings:write');table='attendance_types_details';pk='attendTypeDetailId';columns=['attendTypeDetailId','attendanceName','attendanceCode','attendanceType','logOnTime','logOffTime','status','createdAt'];search=['attendanceName','attendanceCode'];}
  else if(kind==='encryption'){requirePermission(req,'settings:write');table='login_encrypt_details';pk='loginEncDecDetailId';columns=['loginEncDecDetailId','loginType','encryptType','status','createdAt'];search=['encryptType'];}
  else if(kind==='requests'){table='portal_requests';columns=['id','userId','name','kind','description','startDate','endDate','status','createdAt'];search=['name','description','kind'];}
  else if(kind==='notifications'){table='portal_notifications';columns=['id','name','description','audience','recipientId','createdAt'];search=['name','description'];}
  else if(catalogKinds.includes(kind)){requirePermission(req,'settings:write');table='portal_catalog';columns=['id','kind','code','name','description','payload','status','createdAt'];search=['name','code','description'];}
  else fail(404,'This workspace section does not exist.');
  query=db(table);if(table==='portal_catalog')query.where({kind});if(kind==='requests'&&!permitted(req,'requests:review'))query.where({userId:req.user.userId});if(kind==='notifications')query.where(function(){this.where('recipientId',req.user.userId).orWhere(function(){this.whereNull('recipientId').whereIn('audience',req.user.roleName==='admin'?['all','admin']:['all']);});});return {kind,table,pk,columns,search,query};
 }
 router.get('/resources/:kind',asyncRoute(async(req,res)=>{const r=await resource(req);const page=integer(req.query.page||1,'Page',1,100000),limit=integer(req.query.limit||10,'Page size',1,100);const q=text(req.query.q,'Search',150,false);if(q)r.query.where(function(){r.search.forEach((column,i)=>this[i?'orWhere':'where'](column,'like','%'+q+'%'));});if(req.query.status!==undefined&&req.query.status!=='')r.query.where('status',text(req.query.status,'Status',20));const sort=r.columns.includes(req.query.sort)?req.query.sort:r.columns.includes('createdAt')?'createdAt':r.pk;const direction=req.query.direction==='asc'?'asc':'desc';const [count]=await r.query.clone().count('* as count');let rows=await r.query.clone().select(r.columns).orderBy(sort,direction).orderBy(r.pk,'asc').limit(limit).offset((page-1)*limit);
  if(r.kind==='requests'&&rows.length){const users=await db('employees').whereIn('userId',rows.map(x=>x.userId)).select('userId','empId');const ids=Object.fromEntries(users.map(u=>[u.userId,u.empId]));rows=rows.map(row=>({...row,empId:ids[row.userId]}));}
  ok(res,{list:rows.map(row=>{const payload=parse(row.payload);delete row.payload;return {...payload,...row,id:row[r.pk]};}),count:Number(count.count)});
 }));
 async function saveResource(req,res){const r=await resource(req);const id=req.params.id?integer(req.params.id,'Record ID',1,2147483647):null;const old=id?await r.query.clone().where(r.pk,id).first():null;if(id&&!old)fail(404,'This record no longer exists.');let data={};
  if(r.kind==='employees'){
   requirePermission(req,'employees:write');const b=req.body;const role=text(b.roleName||'employee','Role',20);if(!(await db('portal_catalog').where({kind:'roles',code:role,status:1}).first()))fail(400,'Choose an active role from the role directory.');
   if((role!=='employee'||old&&old.roleName!=='employee')&&!permitted(req,'settings:write'))fail(403,'Only a workspace administrator can change privileged accounts.');
   const status=integer(b.status,'Status',0,3);if(old&&old.userId===req.user.userId&&(status!==1||role!==old.roleName))fail(400,'You cannot disable or change your own workspace role.');
   if(old&&old.roleName==='admin'&&(role!=='admin'||status!==1)){const [admins]=await db('employees').where({roleName:'admin',status:1}).count('* as count');if(Number(admins.count)<=1)fail(400,'Keep at least one active administrator.');}
   data={firstName:text(b.firstName,'First name',50),lastName:text(b.lastName,'Last name',50,false),email:email(b.email),roleName:role,status};const username=text(b.userName,'Username',50);if(old&&username!==old.userName)fail(400,'Username changes need a coordinated login update and are not supported here.');data.userName=username;if(!id)data.empId=text(b.empId,'Employee ID',50);
  }else if(r.kind==='attendance-types'){requirePermission(req,'settings:write');data={attendanceName:text(req.body.attendanceName,'Schedule name',50),attendanceCode:text(req.body.attendanceCode,'Schedule code',20),attendanceType:text(req.body.attendanceType,'Capture method',50),logOnTime:text(req.body.logOnTime,'Start time',20),logOffTime:text(req.body.logOffTime,'End time',20),status:integer(req.body.status,'Status',0,1)};if(!['Online','Bio-Metric'].includes(data.attendanceType)||![data.logOnTime,data.logOffTime].every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)))fail(400,'Choose a capture method and valid HH:MM times.');}
  else if(r.kind==='encryption'){requirePermission(req,'settings:write');data={loginType:integer(req.body.loginType,'Login type',1,3),encryptType:text(req.body.encryptType,'Algorithm',50),status:integer(req.body.status,'Status',0,1)};if(!id||req.body.encryptKey)data.encryptKey=text(req.body.encryptKey,'Encryption key',512);}
  else if(r.kind==='requests'){if(id)fail(405,'Use the review action to update a pending request.');const kind=text(req.body.kind,'Category',32);if(!['leave','equipment','general'].includes(kind))fail(400,'Choose a valid request category.');data={name:text(req.body.name,'Subject'),description:text(req.body.description,'Details',4000),kind,userId:req.user.userId,status:'pending',startDate:date(req.body.startDate,'Start date'),endDate:date(req.body.endDate,'End date')};if((data.startDate&&!data.endDate)||(!data.startDate&&data.endDate)||data.startDate&&data.endDate<data.startDate)fail(400,'Choose a complete date range with the end on or after the start.');}
  else if(r.kind==='notifications'){requirePermission(req,'notifications:write');const audience=text(req.body.audience,'Audience',20);if(!['all','admin'].includes(audience))fail(400,'Choose a valid audience.');data={name:text(req.body.name,'Headline'),description:text(req.body.description,'Message',4000),audience};}
  else if(r.table==='portal_catalog'){
   requirePermission(req,'settings:write');if(r.kind==='permissions')fail(405,'Permission codes are defined by the server and cannot be changed here.');const code=text(req.body.code,'Code',80);if(!/^[a-zA-Z0-9_-]+$/.test(code))fail(400,'Codes can contain letters, numbers, underscores and hyphens.');if(old&&code!==old.code)fail(400,'The code cannot be changed after creation.');
   if(r.kind==='roles'&&code==='admin')fail(400,'The built-in administrator role cannot be changed.');let payload={};
   if(r.kind==='roles'){const allowed=String(req.body.permissions||'').split(',').map(p=>p.trim()).filter(Boolean);if(allowed.some(p=>!permissionCodes.includes(p)))fail(400,'Use permission codes from the permission registry.');payload.permissions=[...new Set(allowed)].join(',');}
   if(r.kind==='menus'){payload.path=text(req.body.path,'Route',200);if(!/^\/admin\/(dashboard|employees\/(all-employees|login-history)|forms\/(menus|roles|permissions|attendance-types|leave-types|login-encrypt-decrypt)|requests|notifications)$/.test(payload.path))fail(400,'Choose an existing internal workspace route.');}
   if(r.kind==='leave-types'){payload.allowance=integer(req.body.allowance,'Annual allowance',0,366);payload.paid=req.body.paid==='yes'?'yes':'no';}
   const status=integer(req.body.status,'Status',0,1);if(r.kind==='roles'&&!status&&(await db('employees').where({roleName:code,status:1}).first()))fail(400,'Reassign active employees before disabling their role.');
   data={kind:r.kind,code,name:text(req.body.name,'Name'),description:text(req.body.description,'Description',4000,false),status,payload:JSON.stringify(payload)};
  }else fail(405,'This section is read-only.');
  if(id){if(r.table!=='portal_notifications')data.updatedAt=db.fn.now();await db(r.table).where(r.pk,id).update(data);}else{if(!['portal_requests'].includes(r.table))data.createdBy=req.user.userId;const [newId]=await db(r.table).insert(data);return ok(res,{id:newId},'Record created.');}ok(res,{id},'Changes saved.');
 }
 router.post('/resources/:kind',asyncRoute(saveResource));router.put('/resources/:kind/:id',asyncRoute(saveResource));
 router.put('/requests/:id/review',asyncRoute(async(req,res)=>{requirePermission(req,'requests:review');const id=integer(req.params.id,'Request ID',1,2147483647);const status=req.body.status;if(!['approved','rejected'].includes(status))fail(400,'Choose approve or decline.');await db.transaction(async trx=>{const request=await trx('portal_requests').where({id}).forUpdate().first();if(!request)fail(404,'Request not found.');if(request.status!=='pending')fail(409,'This request has already been reviewed.');if(request.userId===req.user.userId)fail(403,'Another reviewer must review your own request.');if(request.kind==='access'&&!permitted(req,'employees:write'))fail(403,'Employee management permission is required to approve access.');await trx('portal_requests').where({id}).update({status,reviewedBy:req.user.userId,updatedAt:trx.fn.now()});if(request.kind==='access')await trx('employees').where({userId:request.userId,status:2}).update({status:status==='approved'?1:0});await trx('portal_notifications').insert({name:'Your request was '+status,description:request.name,audience:'personal',recipientId:request.userId,createdBy:req.user.userId});});ok(res,{id,status},'Request '+status+'.');}));
 router.get('/employees/:empId',asyncRoute(async(req,res)=>{const empId=text(req.params.empId,'Employee ID',50);if(empId!==req.user.empId)requirePermission(req,'employees:read');const employee=await db('employees').where({empId}).first();if(!employee)fail(404,'Employee not found.');for(const key of ['address','profile'])employee[key]=parse(employee[key],null);const normalize=row=>{if(!row)return null;for(const key of Object.keys(row)){if(key.endsWith('Info'))row[key]=parse(row[key],null);}return row;};const basic=normalize(await db('employee_basic_details').where({empId}).first());const bank=normalize(await db('employee_bank_details').where({empId}).first());if(bank){delete bank.atmCardInfo;delete bank.personalBanksInfo;if(bank.accountNumber)bank.accountNumber='•••• '+String(bank.accountNumber).slice(-4);}
 const onboarding=normalize(await db('employee_onboarding_details').whereRaw("JSON_UNQUOTE(JSON_EXTRACT(employeeInfo, '$.empId')) = ?",[empId]).orderBy('empOnboardDetailId','desc').first());const process=await db('employee_process_details').where({empId}).orderBy('empProcessId','asc');ok(res,{employeeInfo:employee,empBasicInfo:basic,empBankInfo:bank,empOnboardingInfo:onboarding,empProcessInfo:process});}));
 router.get('/shortcuts',asyncRoute(async(req,res)=>{const records=await db('portal_catalog').where({kind:'menus',status:1}).select('name','payload');ok(res,records.map(r=>({name:r.name,path:parse(r.payload).path})).filter(r=>r.path&&!r.path.startsWith('/admin/learn')));}));
 const errorHandler=(error,req,res,next)=>{if(res.headersSent)return next(error);const status=error.status||(['ER_DUP_ENTRY'].includes(error.code)?409:['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(error.code)?503:500);const message=error.status?error.message:status===409?'This identifier or email already exists. Choose a different value.':status===503?'Database setup is incomplete. Apply the backend migrations and try again.':'The request could not be completed. Please try again.';res.status(status).json({success:false,message});};
 router.use(errorHandler);router.handlers={login,signup,forgot,reset,logout,authenticate,errorHandler};return router;
};
