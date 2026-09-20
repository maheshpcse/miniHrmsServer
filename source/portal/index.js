'use strict';
const nodemailer=require('nodemailer');
const {knex}=require('../configs/knex');
const createPortal=require('./router');
let mailer=null;
if(process.env.MAIL_NAME&&process.env.MAIL_PASSWORD){
 const smtp=nodemailer.createTransport({host:process.env.SMTP_HOST||'smtp.gmail.com',port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE?process.env.SMTP_SECURE==='true':Number(process.env.SMTP_PORT||465)===465,auth:{user:process.env.MAIL_NAME,pass:process.env.MAIL_PASSWORD}});
 mailer=message=>smtp.sendMail({...message,from:process.env.MAIL_NAME});
}
module.exports=createPortal({db:knex,secret:process.env.PORTAL_SECURITY_KEY||process.env.SECURITY_KEY,mailer});
