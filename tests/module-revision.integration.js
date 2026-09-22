'use strict';
const assert = require('assert');
module.exports = async ({ db, request, token, userId }) => {
  const hierarchy = await request('/core/hierarchy', 'GET', null, token);
  assert(
    !hierarchy.data.nodes.some((n) => n.id === userId || n.roleName === 'admin')
  );
  const context = await request('/core/context', 'GET', null, token);
  assert(context.data.canReview);
  assert(!context.data.people.some((p) => p.id === userId));
  const {
    enqueue,
    runBatch,
  } = require('../source/portal/modules/communications/delivery-service');
  const employee = await db('employees')
    .where({ userName: 'core.outside' })
    .first();
  await db('employees')
    .where({ userId: employee.userId })
    .update({
      profile: JSON.stringify({
        mobile: '+15555550101',
        deliveryPreferences: { email: true, sms: true },
      }),
    });
  let notice;
  await db.transaction(async (trx) => {
    [notice] = await trx('portal_notifications').insert({
      name: 'Synthetic update',
      description: 'Test',
      audience: 'personal',
      recipientId: employee.userId,
      createdBy: userId,
    });
    await enqueue(trx, notice, employee.userId);
  });
  assert.equal(
    (await db('notification_delivery').where({ notification_id: notice }))
      .length,
    2
  );
  let calls = 0;
  const send = async (message) => {
    calls++;
    assert(message.text.includes('Sign in'));
    assert(!message.text.includes('salary'));
    return { id: 'synthetic-provider-id' };
  };
  const outcome = await runBatch({ db, sendEmail: send, sendSms: send });
  assert.equal(outcome.accepted, 2);
  assert.equal(calls, 2);
  await runBatch({ db, sendEmail: send, sendSms: send });
  assert.equal(calls, 2, 'Accepted messages must not be resent');
  await db('notification_delivery')
    .where({ notification_id: notice, channel: 'sms' })
    .update({ status: 'queued' });
  const uncertain = await runBatch({
    db,
    sendSms: async () => {
      throw Error('Timeout');
    },
  });
  assert.equal(uncertain.unknown, 1);
  await runBatch({ db, sendEmail: send, sendSms: send });
  assert.equal(calls, 2, 'Ambiguous sends must not be retried');
  await db('notification_delivery')
    .where({ notification_id: notice, channel: 'sms' })
    .update({ status: 'queued' });
  await db('employees')
    .where({ userId: employee.userId })
    .update({
      profile: JSON.stringify({
        mobile: '+15555550101',
        deliveryPreferences: { email: true, sms: false },
      }),
    });
  assert.equal(
    (await runBatch({ db, sendSms: send })).skipped,
    1,
    'Opt-out is rechecked at delivery'
  );
  const providers = require('../source/portal/modules/communications/providers');
  let posted = false;
  const adapter = providers(
    {
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32),
      TWILIO_AUTH_TOKEN: 'synthetic-secret',
      TWILIO_FROM: '+15555550102',
    },
    async (url, options) => {
      posted = true;
      assert.equal(new URL(url).hostname, 'api.twilio.com');
      assert.equal(new URLSearchParams(options.body).get('To'), '+15555550101');
      return { ok: true, json: async () => ({ sid: 'SM-test' }) };
    }
  );
  assert.equal(
    (await adapter.sendSms({ to: '+15555550101', text: 'Synthetic test' })).id,
    'SM-test'
  );
  assert(posted);
  let transportOptions;
  const smtp=providers({SMTP_HOST:'smtp.example.invalid',SMTP_PORT:'587',MAIL_NAME:'sender@example.invalid',MAIL_PASSWORD:'fake'},null,options=>{transportOptions=options;return {sendMail:async()=>({accepted:['receiver@example.invalid'],messageId:'mail-test'})};});
  assert.equal((await smtp.sendEmail({to:'receiver@example.invalid',text:'Test'})).id,'mail-test');assert.equal(transportOptions.secure,false);
  const rejected=providers({SMTP_HOST:'smtp.example.invalid',MAIL_NAME:'sender@example.invalid',MAIL_PASSWORD:'fake'},null,()=>({sendMail:async()=>({accepted:[]})}));
  await assert.rejects(rejected.sendEmail({to:'receiver@example.invalid'}),e=>e.definite===true);
  await db('notification_delivery').where({notification_id:notice,channel:'email'}).update({status:'queued'});
  const before=calls;await Promise.all([runBatch({db,sendEmail:send}),runBatch({db,sendEmail:send})]);assert.equal(calls,before+1,'Concurrent workers must claim a message once');

  const prefs = await request(
    '/me',
    'PUT',
    {
      firstName: 'Alex',
      lastName: 'Morgan',
      mobile: '12345',
      deliveryPreferences: { email: true, sms: true },
    },
    token
  );
  assert.equal(prefs.status, 400);
  console.log(
    'PASS REVISION: hierarchy/admin exclusion, capability context, transactional email/SMS queue, provider request, no duplicate accepted/uncertain sends, opt-out and E.164 validation. No external messages sent.'
  );
};
