'use strict';
const express = require('express'),
  crypto = require('crypto');
const {
  parse,
  fail,
  text,
  number,
  date,
  instant,
  day,
  today,
  choice,
  digest,
} = require('./validation');
module.exports = ({ db, secret }) => {
  const r = express.Router(),
    wrap = (fn) => (req, res, next) =>
      Promise.resolve(fn(req, res)).catch(next),
    ok = (res, data) => res.json({ success: true, data });
  const hr = (req) =>
    req.user.roleName === 'admin' || req.permissions.includes('hr:manage');
  const payroll = (req) =>
    req.user.roleName === 'admin' || req.permissions.includes('payroll:manage');
  const need = (req, kind = 'hr') => {
    if (!(kind === 'payroll' ? payroll(req) : hr(req)))
      fail(403, 'You do not have permission for this action.');
  };
  const uid = (req) => req.user.userId;
  const org = async (trx) => {
    const o = await trx('org_entity').orderBy('id').first().forUpdate();
    if (!o) fail(503, 'Organization setup is not ready.');
    return o;
  };
  const audit = (trx, req, module, action, id, metadata = {}) =>
    trx('audit_log').insert({
      actor_id: uid(req),
      module,
      action,
      entity_id: id,
      metadata: JSON.stringify(metadata),
    });
  const notify = async (trx, req, employee, title) => {
    const [id] = await trx('portal_notifications').insert({
      name: title,
      description: 'Open your HR workspace to view the update.',
      audience: 'personal',
      recipientId: employee,
      createdBy: uid(req),
    });
    await require('../modules/communications/delivery-service').enqueue(
      trx,
      id,
      employee
    );
    return id;
  };
  const activeJobs = async (trx) =>
    trx('emp_job_assignment')
      .where('effective_from', '<=', today())
      .where(function () {
        this.whereNull('effective_to').orWhere('effective_to', '>=', today());
      })
      .orderBy('effective_from', 'desc');
  const team = async (req, trx = db) => {
    const rows = await activeJobs(trx),
      ids = new Set([uid(req)]);
    let more = true;
    while (more) {
      more = false;
      for (const a of rows)
        if (ids.has(a.manager_id) && !ids.has(a.employee_id)) {
          ids.add(a.employee_id);
          more = true;
        }
    }
    return [...ids];
  };
  const scoped = async (req, q, key = 'employee_id') => ({
    query: (hr(req) ? q : q.whereIn(key, await team(req))).whereNotIn(
      key,
      db('employees').select('userId').where('roleName', 'admin')
    ),
  });
  const person = async (trx, id) => {
    const p = await trx('employees')
      .where({ userId: number(id, 'Employee') })
      .first();
    if (!p) fail(404, 'Employee not found.');
    return p;
  };
  const manager = async (trx, id) => {
    const a = (await activeJobs(trx)).find((j) => j.employee_id === id);
    return a && a.manager_id;
  };
  const workflow = async (trx, req, module, id) => {
    const [w] = await trx('wf_instance').insert({
      employee_id: uid(req),
      module,
      entity_id: id,
      reviewer_id: (await manager(trx, uid(req))) || null,
    });
    await audit(trx, req, module, 'submitted', id);
    const boss = await manager(trx, uid(req));
    if (boss) await notify(trx, req, boss, 'An HR request needs review');
    return w;
  };
  const policy = async (trx, module, on = today()) => {
    const row = await trx('hr_policy')
      .where({ module })
      .where('effective_from', '<=', on)
      .orderBy('effective_from', 'desc')
      .orderBy('id', 'desc')
      .first();
    return row ? parse(row.rules) : {};
  };
  const unlocked = async (trx, d) => {
    if (
      await trx('att_period_lock')
        .where({ period: d.slice(0, 7) })
        .first()
    )
      fail(
        409,
        'This period is locked. Submit a future payroll adjustment through HR.'
      );
  };
  const list = async (req, q, searchColumns = []) => {
    const page = number(req.query.page || 1, 'Page', 1, 100000),
      limit = number(req.query.limit || 20, 'Page size', 1, 100);
    if (req.query.q) {
      const s = text(req.query.q, 'Search', 150);
      q.where(function () {
        searchColumns.forEach((c, i) =>
          this[i ? 'orWhere' : 'where'](c, 'like', '%' + s + '%')
        );
      });
    }
    const [count] = await q
      .clone()
      .clearSelect()
      .clearOrder()
      .count('* as count');
    return {
      list: await q.limit(limit).offset((page - 1) * limit),
      count: Number(count.count),
      page,
      limit,
    };
  };
  const localDate = (time, zone) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(time);
  const upload = require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
  }).single('file');
  const receive = (req, res, next) =>
    upload(req, res, (e) => {
      if (e) {
        e.status = 400;
        e.message = 'Upload one PDF, PNG or JPEG file up to 10 MB.';
      }
      next(e);
    });
  const fileKey = crypto
    .createHash('sha256')
    .update(secret + ':hr-files-v1')
    .digest();
  const docAccess = (req, d) =>
    hr(req) || d.employee_id === uid(req) || d.visibility === 'company';
  r.post(
    '/clearance/:id',
    wrap(async (req, res) => {
      need(req);
      await db.transaction(async (trx) => {
        const row = await trx('exit_clearance_item')
          .where({ id: number(req.params.id, 'Clearance') })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Clearance not found.');
        const e = await trx('exit_case')
          .where({ id: row.exit_case_id })
          .first();
        if (e.status !== 'approved')
          fail(409, 'The exit case is not approved.');
        await trx('exit_clearance_item')
          .where({ id: row.id })
          .update({
            status: 'completed',
            remarks: text(req.body.remarks, 'Evidence / remarks', 2000),
            completed_by: uid(req),
            completed_at: new Date(),
          });
        await audit(trx, req, 'exit', 'clearance_completed', row.id);
      });
      ok(res, { saved: true });
    })
  );
  const money = (v, name) => {
    if (typeof v !== 'string' || !/^\d{1,14}(\.\d{1,4})?$/.test(v))
      fail(
        400,
        name + ' must be a non-negative decimal string (up to four decimals).'
      );
    const [whole, fraction = ''] = v.split('.');
    return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  };
  const decimal = (n) =>
    (n / 10000n).toString() + '.' + (n % 10000n).toString().padStart(4, '0');
  const platform = {
    db,
    secret,
    crypto,
    parse,
    fail,
    text,
    number,
    date,
    instant,
    day,
    today,
    choice,
    digest,
    r,
    wrap,
    ok,
    hr,
    payroll,
    need,
    uid,
    org,
    audit,
    notify,
    activeJobs,
    team,
    scoped,
    person,
    manager,
    workflow,
    policy,
    unlocked,
    list,
    localDate,
    upload,
    receive,
    fileKey,
    docAccess,
    money,
    decimal,
  };
  return platform;
};
