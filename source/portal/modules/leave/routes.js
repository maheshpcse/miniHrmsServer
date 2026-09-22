'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  date,
  day,
  db,
  fail,
  hr,
  list,
  need,
  number,
  ok,
  org,
  person,
  policy,
  r,
  scoped,
  text,
  uid,
  unlocked,
  workflow,
  wrap,
}) => {
  r.get(
    '/holidays',
    wrap(async (req, res) =>
      ok(res, {
        list: await db('lv_holiday').orderBy('holiday_date'),
        count: await db('lv_holiday')
          .count('* as n')
          .then((x) => Number(x[0].n)),
      })
    )
  );
  r.post(
    '/holidays',
    wrap(async (req, res) => {
      need(req);
      await db.transaction(async (trx) => {
        const o = await org(trx);
        const [id] = await trx('lv_holiday').insert({
          organization_id: o.id,
          holiday_date: date(req.body.holiday_date),
          name: text(req.body.name, 'Holiday'),
        });
        await audit(trx, req, 'leave', 'holiday_created', id);
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/leave',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          (
            await scoped(req, db('lv_request').orderBy('id', 'desc'))
          ).query,
          ['reason', 'status']
        )
      )
    )
  );
  r.get(
    '/leave/balances',
    wrap(async (req, res) => {
      const q = db('lv_balance as b')
        .join('lv_leave_type as t', 't.id', 'b.leave_type_id')
        .select('b.*', 't.name', 't.paid');
      if (!hr(req)) q.where('b.employee_id', uid(req));
      ok(res, { list: await q.orderBy('leave_year', 'desc') });
    })
  );
  r.get(
    '/leave/types',
    wrap(async (req, res) => {
      need(req);
      ok(res, { list: await db('lv_leave_type').orderBy('name') });
    })
  );
  r.post(
    '/leave/types',
    wrap(async (req, res) => {
      need(req);
      const [id] = await db('lv_leave_type').insert({
        name: text(req.body.name, 'Leave type', 100),
        paid: req.body.paid === true,
        allow_negative: req.body.allow_negative === true,
      });
      ok(res, { id });
    })
  );
  r.post(
    '/leave/adjustments',
    wrap(async (req, res) => {
      need(req);
      const b = req.body,
        employee = number(b.employee_id, 'Employee'),
        type = number(b.leave_type_id, 'Leave type'),
        year = number(b.leave_year, 'Year', 2000, 2200),
        qty = number(b.quantity, 'Days', -366, 366);
      if (!qty) fail(400, 'Enter a non-zero adjustment.');
      await db.transaction(async (trx) => {
        await org(trx);
        await person(trx, employee);
        if (!(await trx('lv_leave_type').where({ id: type }).first()))
          fail(404, 'Leave type not found.');
        let balance = await trx('lv_balance')
          .where({
            employee_id: employee,
            leave_type_id: type,
            leave_year: year,
          })
          .forUpdate()
          .first();
        if (!balance) {
          const [id] = await trx('lv_balance').insert({
            employee_id: employee,
            leave_type_id: type,
            leave_year: year,
          });
          balance = { id, available: 0 };
        }
        if (Number(balance.available) + qty < 0)
          fail(400, 'Adjustment would make available balance negative.');
        await trx('lv_balance')
          .where({ id: balance.id })
          .increment('available', qty);
        const [id] = await trx('lv_accrual_ledger').insert({
          employee_id: employee,
          leave_type_id: type,
          leave_year: year,
          quantity: qty,
          transaction_type: 'adjustment',
          reference: text(b.reference, 'Adjustment reason', 200),
          created_by: uid(req),
        });
        await audit(trx, req, 'leave', 'balance_adjusted', id);
      });
      ok(res, { saved: true });
    })
  );
  r.post(
    '/leave',
    wrap(async (req, res) => {
      const b = req.body,
        start = date(b.start_date),
        end = date(b.end_date);
      if (end < start || end.slice(0, 4) !== start.slice(0, 4))
        fail(400, 'Choose an ordered date range within one leave year.');
      const type = number(b.leave_type_id, 'Leave type');
      await db.transaction(async (trx) => {
        await org(trx);
        const t = await trx('lv_leave_type').where({ id: type }).first();
        if (!t) fail(404, 'Leave type not found.');
        await trx('employees')
          .where({ userId: uid(req) })
          .forUpdate()
          .first();
        if (
          await trx('lv_request')
            .where({ employee_id: uid(req) })
            .whereIn('status', ['pending', 'approved'])
            .where('start_date', '<=', end)
            .where('end_date', '>=', start)
            .first()
        )
          fail(409, 'The dates overlap an existing leave request.');
        const holidays = new Set(
          (
            await trx('lv_holiday').whereBetween('holiday_date', [start, end])
          ).map((h) => day(h.holiday_date))
        );
        const leavePolicy = await policy(trx, 'Leave', start);
        const weekends =
          leavePolicy.weekend_policy === 'No weekly offs'
            ? []
            : leavePolicy.weekend_policy === 'Sunday'
            ? [0]
            : [0, 6];
        const days = [];
        for (
          let d = new Date(start);
          d <= new Date(end);
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          await unlocked(trx, day(d));
          if (!weekends.includes(d.getUTCDay()) && !holidays.has(day(d)))
            days.push(day(d));
        }
        if (!days.length) fail(400, 'This range contains no working days.');
        const year = Number(start.slice(0, 4));
        let balance = await trx('lv_balance')
          .where({
            employee_id: uid(req),
            leave_type_id: type,
            leave_year: year,
          })
          .forUpdate()
          .first();
        if (!balance) {
          const [id] = await trx('lv_balance').insert({
            employee_id: uid(req),
            leave_type_id: type,
            leave_year: year,
          });
          balance = { id, available: 0 };
        }
        if (
          t.paid &&
          !t.allow_negative &&
          Number(balance.available) < days.length
        )
          fail(400, 'Your available leave balance is insufficient.');
        const [id] = await trx('lv_request').insert({
          employee_id: uid(req),
          leave_type_id: type,
          start_date: start,
          end_date: end,
          requested_units: days.length,
          reason: text(b.reason, 'Reason', 2000),
        });
        await trx('lv_request_day').insert(
          days.map((d) => ({ request_id: id, leave_date: d, units: 1 }))
        );
        await trx('lv_balance')
          .where({ id: balance.id })
          .update({
            available: trx.raw('available - ?', [days.length]),
            reserved: trx.raw('reserved + ?', [days.length]),
          });
        await trx('lv_accrual_ledger').insert({
          employee_id: uid(req),
          leave_type_id: type,
          leave_year: year,
          transaction_type: 'reserved',
          quantity: -days.length,
          request_id: id,
          created_by: uid(req),
        });
        await workflow(trx, req, 'leave', id);
      });
      ok(res, { submitted: true });
    })
  );
  r.post(
    '/leave/:id/cancel',
    wrap(async (req, res) => {
      await db.transaction(async (trx) => {
        await org(trx);
        const row = await trx('lv_request')
          .where({ id: number(req.params.id, 'Leave') })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Leave not found.');
        if (row.employee_id !== uid(req))
          fail(403, 'Only the requester can cancel leave.');
        if (!['pending', 'approved'].includes(row.status))
          fail(409, 'This request is already closed.');
        const days = await trx('lv_request_day').where({ request_id: row.id });
        for (const d of days) await unlocked(trx, day(d.leave_date));
        await trx('lv_balance')
          .where({
            employee_id: row.employee_id,
            leave_type_id: row.leave_type_id,
            leave_year: Number(day(row.start_date).slice(0, 4)),
          })
          .update({
            available: trx.raw('available + ?', [row.requested_units]),
            reserved: trx.raw('reserved - ?', [
              row.status === 'pending' ? row.requested_units : 0,
            ]),
          });
        await trx('lv_accrual_ledger').insert({
          employee_id: row.employee_id,
          leave_type_id: row.leave_type_id,
          leave_year: Number(day(row.start_date).slice(0, 4)),
          transaction_type: 'cancelled',
          quantity: row.requested_units,
          request_id: row.id,
          created_by: uid(req),
        });
        await trx('lv_request')
          .where({ id: row.id })
          .update({ status: 'cancelled' });
        await trx('wf_instance')
          .where({ module: 'leave', entity_id: row.id })
          .update({ status: 'cancelled' });
        await audit(trx, req, 'leave', 'cancelled', row.id);
      });
      ok(res, { saved: true });
    })
  );
};
