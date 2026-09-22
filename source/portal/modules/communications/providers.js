'use strict';
const nodemailer = require('nodemailer');
module.exports = (env = process.env, fetchImpl = global.fetch, createTransport = nodemailer.createTransport) => {
  let sendEmail = null,
    sendSms = null;
  if (env.SMTP_HOST && env.MAIL_NAME && env.MAIL_PASSWORD) {
    const transport = createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465),
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : Number(env.SMTP_PORT || 465) === 465,
      auth: { user: env.MAIL_NAME, pass: env.MAIL_PASSWORD },
      connectionTimeout: 10000,
      socketTimeout: 20000,
    });
    sendEmail = async (message) => {
      const result = await transport.sendMail({
        ...message,
        from: env.MAIL_NAME,
      });
      if (!result.accepted || !result.accepted.length) {const e = new Error('Email provider rejected the recipient.'); e.definite = true; throw e;}
      return { id: result.messageId };
    };
  }
  if (
    env.SMS_PROVIDER === 'twilio' &&
    /^AC[0-9a-fA-F]{32}$/.test(env.TWILIO_ACCOUNT_SID || '') &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_FROM
  ) {
    sendSms = async (message) => {
      const response = await fetchImpl(
        'https://api.twilio.com/2010-04-01/Accounts/' +
          env.TWILIO_ACCOUNT_SID +
          '/Messages.json',
        {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(
                env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN
              ).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: message.to,
            From: env.TWILIO_FROM,
            Body: message.text,
          }).toString(),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!response.ok) {
        const e = new Error('SMS provider rejected the request.');
        e.definite = response.status >= 400 && response.status < 500;
        throw e;
      }
      const result = await response.json();
      return { id: result.sid };
    };
  }
  return { sendEmail, sendSms };
};
