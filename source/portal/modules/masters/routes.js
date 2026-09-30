'use strict';
module.exports=({r,wrap,ok,need,db,parse})=>{
 r.get('/masters',wrap(async(req,res)=>{
  need(req);res.set('Cache-Control','no-store');
  const q=db('hrms_master_value').where({scope_key:'SYSTEM'});
  if(req.query.category)q.where('category_code',String(req.query.category).slice(0,64));
  const rows=await q.orderBy('category_code').orderBy('code');
  ok(res,{categories:await db('hrms_master_category').orderBy('name'),list:rows.map(row=>({...row,config:parse(row.config)})),count:rows.length});
 }));
};
