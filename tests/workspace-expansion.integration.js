'use strict';
const assert = require('assert'),
  crypto = require('crypto');
module.exports = async ({ db, request, token, userId }) => {
  await db('portal_rate_limits').del();
  const api = (path, method = 'GET', body, auth = token) =>
    request('/core' + path, method, body, auth);
  const login = async (name) => {
    const r = await request('/auth/login', 'POST', {
      username: 'core.' + name,
      password: 'Employee-Test-123!',
    });
    assert.equal(r.status, 200);
    return r.data.token;
  };
  const emp = await db('employees')
      .where({ userName: 'core.employee' })
      .first(),
    outside = await db('employees').where({ userName: 'core.outside' }).first(),
    manager = await db('employees').where({ userName: 'core.manager' }).first();
  const empToken = await login('employee'),
    otherToken = await login('outside'),
    managerToken = await login('manager'),
    financeToken = await login('finance');
  const room = await api(
    '/chat/rooms',
    'POST',
    { members: [outside.userId] },
    empToken
  );
  assert.equal(room.status, 200);
  const roomId = room.data.id;
  assert.equal(
    (
      await api(
        '/chat/rooms/' + roomId + '/messages',
        'GET',
        null,
        managerToken
      )
    ).status,
    404
  );
  const message = await api(
    '/chat/rooms/' + roomId + '/messages',
    'POST',
    { body: 'Synthetic private message', client_nonce: 'test-message-one' },
    empToken
  );
  assert.equal(message.status, 200);
  const replay = await api(
    '/chat/rooms/' + roomId + '/messages',
    'POST',
    { body: 'Synthetic private message', client_nonce: 'test-message-one' },
    empToken
  );
  assert.equal(replay.data.id, message.data.id);
  assert.equal(
    (
      await api(
        '/chat/rooms/' + roomId + '/messages',
        'POST',
        { body: 'Changed', client_nonce: 'test-message-one' },
        empToken
      )
    ).status,
    409
  );
  const roomList = await api('/chat/rooms', 'GET', null, otherToken);
  assert.equal(roomList.data.find((r) => r.id === roomId).unread, 1);
  assert.equal(
    (
      await api(
        '/chat/rooms/' + roomId + '/read',
        'POST',
        { message_id: message.data.id },
        otherToken
      )
    ).status,
    200
  );
  assert.equal(
    (await api('/chat/rooms', 'GET', null, otherToken)).data.find(
      (r) => r.id === roomId
    ).unread,
    0
  );
  const engine = require('../source/portal/modules/payroll/calculator');
  const rules = {
    annual_allowance: '0',
    bands: [
      { up_to: '12000', rate_bps: 0 },
      { up_to: null, rate_bps: 1000 },
    ],
    levies: [],
  };
  const calc = engine.calculate({
    components: [
      {
        code: 'BASIC',
        name: 'Basic',
        type: 'EARNING',
        amount: '3000',
        prorate: true,
      },
    ],
    rules,
    paidDays: 30,
    periodDays: 30,
    remainingMonths: 11,
  });
  assert.equal(calc.tax, '200.0000');
  assert.equal(calc.net, '2800.0000');
  const yen = engine.calculate({
    components: [
      {
        code: 'BASIC',
        name: 'Basic',
        type: 'EARNING',
        amount: '3000',
        prorate: true,
      },
    ],
    rules: {
      currency_decimals: 0,
      bands: [{ up_to: null, rate_bps: 0 }],
      levies: [],
    },
    paidDays: 1,
    periodDays: 31,
  });
  assert.equal(yen.net, '97.0000');
  assert.equal(
    engine.fingerprint({ a: 1, b: { c: 2, d: 3 } }),
    engine.fingerprint({ b: { d: 3, c: 2 }, a: 1 })
  );
  assert.throws(() =>
    engine.validateRules({ bands: [{ up_to: '100', rate_bps: 10 }] })
  );
  assert.equal(
    (await api('/payroll/settings', 'GET', null, empToken)).status,
    403
  );
  const policy = await api('/payroll/tax-policies', 'POST', {
    name: 'Synthetic monthly policy',
    country: 'US',
    region: 'Test region',
    tax_year: '2026',
    currency: 'USD',
    effective_from: '2026-01-01',
    effective_to: '2026-12-31',
    source_reference: 'Synthetic fixture, not real tax law',
    rules,
  });
  assert.equal(policy.status, 200, policy.message);
  assert.equal(
    (
      await api(
        '/payroll/tax-policies/' + policy.data.id + '/activate',
        'POST',
        { reviewed: true }
      )
    ).status,
    200
  );
  assert.equal(
    (
      await api('/payroll/compensation', 'POST', {
        employee_id: outside.userId,
        tax_policy_id: policy.data.id,
        effective_from: '2026-01-01',
        components: [
          {
            code: 'BASIC',
            name: 'Basic salary',
            type: 'EARNING',
            amount: '3000',
            prorate: true,
          },
        ],
      })
    ).status,
    200
  );
  const [lock] = await db('att_period_lock').insert({
    period: '2026-02',
    locked_by: userId,
  });
  await db('att_payroll_summary').insert({
    employee_id: outside.userId,
    lock_id: lock,
    worked_minutes: 9000,
    overtime_minutes: 0,
    paid_leave_days: 0,
    unpaid_leave_days: 0,
    source_checksum: 'synthetic-lock',
  });
  const input = await api(
    '/payroll/inputs?employee_id=' + outside.userId + '&period=2026-02'
  );
  assert.equal(input.status, 200, input.message);
  assert.equal(input.data.period_days, 28);
  const draft = await api('/payroll/runs', 'POST', {
    employee_id: outside.userId,
    period: '2026-02',
    paid_days: 28,
    ytd_gross: '3000',
    ytd_tax: '200',
    input_note: 'Synthetic payroll input review',
  });
  assert.equal(draft.status, 200, draft.message);
  const id = draft.data.id;
  assert.equal(
    (await api('/payroll/runs/' + id + '/review', 'POST', {})).status,
    403
  );
  assert.equal(
    (await api('/payroll/runs/' + id + '/finalize', 'POST', {})).status,
    409
  );
  assert.equal(
    (await api('/payroll/runs/' + id + '/review', 'POST', {}, financeToken))
      .status,
    200
  );
  const final = await api('/payroll/runs/' + id + '/finalize', 'POST', {});
  assert.equal(final.status, 200, final.message);
  assert.equal(
    (await api('/payroll/runs/' + id + '/finalize', 'POST', {})).data.id,
    final.data.id
  );
  assert.equal(
    (await api('/salary/' + final.data.id, 'GET', null, otherToken)).status,
    404,
    'Unpublished result must be private'
  );
  assert.equal(
    (await api('/salary/' + final.data.id + '/publish', 'POST', {})).status,
    200
  );
  assert.equal(
    (await api('/salary/' + final.data.id, 'GET', null, otherToken)).status,
    200
  );
  assert.equal((await api('/payroll/tax-register')).status, 200);
  const previous = {
    enabled: process.env.PUSH_ENABLED,
    public: process.env.VAPID_PUBLIC_KEY,
    private: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  process.env.PUSH_ENABLED = 'true';
  const keys = require('web-push').generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.invalid';
  try {
    const key = crypto.createECDH('prime256v1');
    key.generateKeys();
    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-fixture',
      keys: {
        p256dh: key.getPublicKey().toString('base64url'),
        auth: crypto.randomBytes(16).toString('base64url'),
      },
    };
    assert.equal(
      (
        await api(
          '/push/subscribe',
          'POST',
          { ...sub, endpoint: 'https://127.0.0.1/internal' },
          empToken
        )
      ).status,
      400,
      'Reject arbitrary server destinations'
    );
    assert.equal(
      (await api('/push/subscribe', 'POST', sub, empToken)).status,
      200
    );
    await db('portal_notifications').insert({
      name: 'Synthetic push',
      description: 'Synthetic',
      audience: 'personal',
      recipientId: emp.userId,
      createdBy: userId,
    });
    let sends = 0;
    const worker = require('../source/portal/modules/push/worker');
    const send = async (subscription, payload) => {
      sends++;
      assert.equal(subscription.endpoint, sub.endpoint);
      const data = JSON.parse(payload);
      assert(!data.body.includes('salary'));
    };
    await worker.runBatch({ db, send });
    assert.equal(sends, 1);
    await worker.runBatch({ db, send });
    assert.equal(sends, 1);
    await api(
      '/push/unsubscribe',
      'POST',
      { endpoint: sub.endpoint },
      empToken
    );
    await db('portal_notifications').insert({
      name: 'After opt out',
      description: 'Synthetic',
      audience: 'personal',
      recipientId: emp.userId,
      createdBy: userId,
    });
    await worker.runBatch({ db, send });
    assert.equal(sends, 1);
  } finally {
    for (const [key, value] of Object.entries({
      PUSH_ENABLED: previous.enabled,
      VAPID_PUBLIC_KEY: previous.public,
      VAPID_PRIVATE_KEY: previous.private,
      VAPID_SUBJECT: previous.subject,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  console.log(
    'PASS EXPANSION: chat membership/unread/idempotency, configured tax math, payroll permissions/review/finalization/publication, push endpoint validation/queue/deduplication/opt-out. No real messages sent.'
  );
};
