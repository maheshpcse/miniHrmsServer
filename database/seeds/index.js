'use strict';
const fs=require('fs'),path=require('path');
const files=fs.readdirSync(__dirname).filter(f=>/^00[1-8]_.*\.json$/.test(f)).sort();
exports.apply=async db=>{
  await db.transaction(async trx=>{
    for(const file of files){
      const pack=JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
      for(const category of pack.categories){
        if(!await trx('hrms_master_category').where({code:category.code}).first())await trx('hrms_master_category').insert({code:category.code,name:category.name});
        for(const value of category.values){
          const key={category_code:category.code,code:value.code,scope_key:'SYSTEM'};
          // Insert missing business codes; never reset tenant/customized state on re-run.
          if(!await trx('hrms_master_value').where(key).first())await trx('hrms_master_value').insert({...key,name:value.name,state:value.state,config:JSON.stringify(value.config),source_pack:file});
        }
      }
      for(const row of pack.catalog){
        if(!await trx('portal_catalog').where({kind:row.kind,code:row.code}).first())await trx('portal_catalog').insert({...row,payload:JSON.stringify(row.payload),description:'System seed: '+file});
      }
    }
  });
};
exports.files=files;
