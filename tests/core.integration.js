'use strict';
const assert = require('assert'),
  bcrypt = require('bcrypt');
module.exports = async ({ db, request, token, userId }) => {
  const api = (path, method = 'GET', body, auth = token) =>
    request('/core' + path, method, body, auth);
  await db('portal_rate_limits').del();
  const hash = await bcrypt.hash('Employee-Test-123!', 10);
  const make = async (name, role = 'employee') => {
    const [id] = await db('employees').insert({
      empId: 'CORE_' + name,
      firstName: name,
      lastName: 'Test',
      userName: 'core.' + name,
      email: name + '@example.invalid',
      roleName: role,
      status: 1,
      createdBy: userId,
    });
    await db('employee_login').insert({
      empId: 'CORE_' + name,
      empLoginName: 'core.' + name,
      empPassword: hash,
      createdBy: userId,
    });
    const login = await request('/auth/login', 'POST', {
      username: 'core.' + name,
      password: 'Employee-Test-123!',
    });
    assert.equal(login.status, 200, login.message);
    return { id, token: login.data.token };
  };
  const emp = await make('employee'),
    manager = await make('manager', 'rm'),
    other = await make('outside'),
    finance = await make('finance', 'fm');
  const post = async (path, body, auth = token, status = 200) => {
    const x = await api(path, 'POST', body, auth);
    assert.equal(x.status, status, path + ': ' + x.message);
    return x.data;
  };
  await post('/assignments', {
    employee_id: emp.id,
    manager_id: manager.id,
    department: 'Engineering',
    designation: 'Developer',
    location: 'Chennai',
    employment_type: 'Permanent',
    effective_from: '2026-01-01',
  });
  await post(
    '/assignments',
    {
      employee_id: manager.id,
      manager_id: emp.id,
      department: 'Engineering',
      designation: 'Manager',
      employment_type: 'Permanent',
      effective_from: '2026-01-01',
    },
    token,
    400
  );
  await post(
    '/assignments',
    {
      employee_id: other.id,
      department: 'HR',
      designation: 'Other',
      employment_type: 'Permanent',
      effective_from: '2026-01-01',
    },
    emp.token,
    403
  );
  const hierarchy = await api('/hierarchy', 'GET', null, emp.token);
  assert.equal(hierarchy.status, 200);
  assert(hierarchy.data.nodes.some((n) => n.id === manager.id));
  assert(!hierarchy.data.nodes.some((n) => n.id === other.id));
  for (const path of [
    '/context',
    '/assignments',
    '/onboarding',
    '/employee-details',
    '/holidays',
    '/attendance',
    '/regularizations',
    '/overtime',
    '/leave',
    '/leave/balances',
    '/approvals',
    '/payroll-inputs',
    '/documents',
    '/notices',
    '/notices/sent',
    '/events',
    '/event-tasks',
    '/surveys',
    '/recognition',
    '/feedback',
    '/exit',
    '/salary',
    '/salary-queries',
    '/audit',
  ]) {
    const x = await api(path);
    assert.equal(x.status, 200, path + ': ' + x.message);
  }
  await post(
    '/attendance/punch',
    { event_type: 'IN', correlation_id: 'test-in' },
    emp.token
  );
  await post(
    '/attendance/punch',
    { event_type: 'IN', correlation_id: 'test-in' },
    emp.token
  );
  assert.equal(
    (await db('att_punch_event').where({ employee_id: emp.id })).length,
    1
  );
  await post(
    '/attendance/punch',
    { event_type: 'IN', correlation_id: 'test-second' },
    emp.token,
    409
  );
  await post(
    '/attendance/punch',
    { event_type: 'BREAK_OUT', correlation_id: 'test-break' },
    emp.token
  );
  await post(
    '/attendance/punch',
    { event_type: 'BREAK_IN', correlation_id: 'test-return' },
    emp.token
  );
  await post(
    '/attendance/punch',
    { event_type: 'OUT', correlation_id: 'test-out' },
    emp.token
  );
  const type = await post('/leave/types', { name: 'Annual', paid: true });
  await post('/leave/adjustments', {
    employee_id: emp.id,
    leave_type_id: type.id,
    leave_year: 2026,
    quantity: 10,
    reference: 'Opening balance',
  });
  await post(
    '/leave',
    {
      leave_type_id: type.id,
      start_date: '2026-10-05',
      end_date: '2026-10-06',
      reason: 'Family time',
    },
    emp.token
  );
  await post(
    '/leave',
    {
      leave_type_id: type.id,
      start_date: '2026-10-06',
      end_date: '2026-10-07',
      reason: 'Overlap',
    },
    emp.token,
    409
  );
  const approval = await db('wf_instance')
    .where({ employee_id: emp.id, module: 'leave' })
    .first();
  await post(
    '/approvals/' + approval.id,
    { action: 'approved' },
    emp.token,
    403
  );
  await post(
    '/approvals/' + approval.id,
    { action: 'approved' },
    other.token,
    403
  );
  await post(
    '/approvals/' + approval.id,
    { action: 'approved' },
    manager.token
  );
  await post(
    '/approvals/' + approval.id,
    { action: 'approved' },
    manager.token,
    409
  );
  let balance = await db('lv_balance').where({ employee_id: emp.id }).first();
  assert.equal(Number(balance.available), 8);
  assert.equal(Number(balance.reserved), 0);
  await post('/leave/' + approval.entity_id + '/cancel', {}, emp.token);
  balance = await db('lv_balance').where({ employee_id: emp.id }).first();
  assert.equal(Number(balance.available), 10);
  await post('/notices', {
    title: 'Private update',
    body: 'Only one recipient',
    audience: 'personal',
    recipient_id: emp.id,
  });
  assert.equal((await api('/notices', 'GET', null, other.token)).data.count, 0);
  assert.equal((await api('/notices', 'GET', null, emp.token)).data.count, 1);
  await post(
    '/notices',
    { title: 'Unauthorized announcement', body: 'No', audience: 'company' },
    emp.token,
    403
  );
  await post('/events', {
    title: 'Team event',
    description: 'Meet',
    starts_at: '2027-01-01T10:00:00Z',
    ends_at: '2027-01-01T11:00:00Z',
    timezone: 'Asia/Kolkata',
    venue: 'Office',
    capacity: 1,
  });
  const event = await db('evt_event').first();
  await Promise.all([
    post('/events/' + event.id + '/rsvp', { response: 'attending' }, emp.token),
    post(
      '/events/' + event.id + '/rsvp',
      { response: 'attending' },
      other.token
    ),
  ]);
  assert.equal(
    (await db('evt_rsvp').where({ response: 'attending' })).length,
    1
  );
  assert.equal(
    (await db('evt_rsvp').where({ response: 'waitlisted' })).length,
    1
  );
  await post('/surveys', {
    title: 'Pulse',
    question: 'How is work?',
    options: ['Good', 'Needs improvement'],
    anonymous: true,
    privacy_threshold: 5,
    closes_at: '2027-01-01T00:00:00Z',
  });
  const survey = await db('eng_survey').first();
  await post('/surveys/' + survey.id + '/respond', { answer: 0 }, emp.token);
  await post(
    '/surveys/' + survey.id + '/respond',
    { answer: 1 },
    emp.token,
    409
  );
  assert.equal((await db('eng_response').first()).employee_id, null);
  assert.equal((await api('/surveys')).data.list[0].results, null);
  const payload = {
    status: 'FINALIZED',
    employee_id: emp.id,
    external_reference: 'CORE-PAY-1',
    source_system: 'Test payroll',
    period: '2026-08',
    currency: 'INR',
    gross: '100.0000',
    deductions: '10.0000',
    tax: '5.0000',
    net: '85.0000',
    input_snapshot: { run: 'external-1' },
    components: [
      { code: 'BASIC', name: 'Basic', type: 'EARNING', amount: '100.0000' },
      {
        code: 'DEDUCTION',
        name: 'Deduction',
        type: 'DEDUCTION',
        amount: '10.0000',
      },
      { code: 'TAX', name: 'Tax', type: 'TAX', amount: '5.0000' },
    ],
  };
  await post('/salary/import', payload, emp.token, 403);
  await post('/salary/import', { ...payload, net: '99' }, finance.token, 400);
  const result = await post('/salary/import', payload, finance.token);
  assert((await post('/salary/import', payload, finance.token)).replayed);
  await post(
    '/salary/import',
    { ...payload, source_system: 'Changed' },
    finance.token,
    409
  );
  assert.equal((await api('/salary', 'GET', null, emp.token)).data.count, 0);
  await post('/salary/' + result.id + '/publish', {}, finance.token);
  assert.equal((await api('/salary', 'GET', null, emp.token)).data.count, 1);
  assert.equal(
    (await api('/salary/' + result.id, 'GET', null, other.token)).status,
    404
  );
  await post(
    '/exit',
    { requested_lwd: '2027-01-01', reason: 'New role' },
    emp.token
  );
  const exit = await db('wf_instance')
    .where({ employee_id: emp.id, module: 'exit' })
    .first();
  await post('/approvals/' + exit.id, { action: 'approved' }, manager.token);
  assert.equal(
    (await db('exit_clearance_item').where({ exit_case_id: exit.entity_id }))
      .length,
    5
  );
  await post('/exit/' + exit.entity_id + '/close', {}, token, 409);
  await post('/policies', {
    module: 'Attendance',
    name: 'Standard workday',
    effective_from: '2026-01-01',
    timezone: 'Asia/Kolkata',
    full_day_minutes: 480,
    half_day_minutes: 240,
  });
  await post('/policies', {
    module: 'Leave',
    name: 'Sunday off',
    effective_from: '2026-01-01',
    weekend_policy: 'Sunday',
  });
  await post('/policies', {
    module: 'Exit',
    name: 'Notice',
    effective_from: '2026-01-01',
    notice_days: 30,
  });
  await post(
    '/policies',
    {
      module: 'Attendance',
      name: 'Invalid',
      effective_from: '2026-01-01',
      timezone: 'Invalid/Zone',
      full_day_minutes: 480,
      half_day_minutes: 240,
    },
    token,
    400
  );
  await post(
    '/policies',
    {
      module: 'Exit',
      name: 'Unauthorized',
      effective_from: '2026-01-01',
      notice_days: 1,
    },
    emp.token,
    403
  );
  await post(
    '/leave',
    {
      leave_type_id: type.id,
      start_date: '2026-10-10',
      end_date: '2026-10-10',
      reason: 'Saturday under Sunday-only policy',
    },
    emp.token
  );
  const now = new Date().toISOString().slice(0, 10);
  await post(
    '/exit',
    { requested_lwd: now, reason: 'Too short' },
    other.token,
    400
  );
  console.log(
    'PASS CORE: role-scoped hierarchy/cycle prevention, module reads, immutable/idempotent punches, leave reservation/approval/cancel, audience privacy, concurrent capacity, anonymous response threshold, exact-decimal/idempotent payroll import/publication/ownership, exit clearance gating.'
  );
};
