'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  day,
  db,
  fail,
  hr,
  list,
  notify,
  number,
  ok,
  org,
  r,
  text,
  uid,
  unlocked,
  wrap,
}) => {
  r.get(
    '/approvals',
    wrap(async (req, res) => {
      const q = db('wf_instance')
        .where({ status: 'pending' })
        .whereNot('employee_id', uid(req))
        .orderBy('id', 'desc');
      if (!hr(req)) q.where({ reviewer_id: uid(req) });
      const result = await list(req, q, ['module']);
      for (const w of result.list) {
        const table = {
          leave: 'lv_request',
          regularizations: 'att_regularization_request',
          overtime: 'att_overtime_request',
          exit: 'exit_case',
        }[w.module];
        const record = table
          ? await db(table).where({ id: w.entity_id }).first()
          : null;
        if (record) {
          w.reason = record.reason;
          w.start_date =
            record.start_date || record.attendance_date || record.requested_lwd;
          w.end_date = record.end_date || null;
          w.requested_units = record.requested_units || record.minutes || null;
        }
      }
      ok(res, result);
    })
  );
  r.post(
    '/approvals/:id',
    wrap(async (req, res) => {
      const action = choice(
        req.body.action,
        ['approved', 'rejected'],
        'decision'
      );
      await db.transaction(async (trx) => {
        await org(trx);
        const w = await trx('wf_instance')
          .where({ id: number(req.params.id, 'Approval') })
          .forUpdate()
          .first();
        if (!w) fail(404, 'Approval not found.');
        if (w.employee_id === uid(req))
          fail(403, 'You cannot review your own request.');
        if (!hr(req) && w.reviewer_id !== uid(req))
          fail(403, 'This request is assigned to another reviewer.');
        if (w.status !== 'pending')
          fail(409, 'This request has already been reviewed.');
        const tables = {
            leave: 'lv_request',
            regularizations: 'att_regularization_request',
            overtime: 'att_overtime_request',
            exit: 'exit_case',
          },
          table = tables[w.module];
        if (!table) fail(400, 'Unsupported approval.');
        const row = await trx(table)
          .where({ id: w.entity_id })
          .forUpdate()
          .first();
        if (!row || row.status !== 'pending')
          fail(409, 'The request is no longer pending.');
        if (w.module === 'leave') {
          const days = await trx('lv_request_day').where({
            request_id: row.id,
          });
          for (const d of days) await unlocked(trx, day(d.leave_date));
          const year = Number(day(row.start_date).slice(0, 4));
          await trx('lv_balance')
            .where({
              employee_id: row.employee_id,
              leave_type_id: row.leave_type_id,
              leave_year: year,
            })
            .update({
              reserved: trx.raw('reserved - ?', [row.requested_units]),
              available: trx.raw('available + ?', [
                action === 'rejected' ? row.requested_units : 0,
              ]),
            });
          await trx('lv_accrual_ledger').insert({
            employee_id: row.employee_id,
            leave_type_id: row.leave_type_id,
            leave_year: year,
            transaction_type: action,
            quantity: action === 'rejected' ? row.requested_units : 0,
            request_id: row.id,
            created_by: uid(req),
          });
        } else if (w.module === 'regularizations' || w.module === 'overtime') {
          await unlocked(trx, day(row.attendance_date));
          if (action === 'approved' && w.module === 'regularizations') {
            const data = {
              employee_id: row.employee_id,
              attendance_date: day(row.attendance_date),
              worked_minutes: row.minutes,
              status: 'regularized',
            };
            const last = await trx('att_punch_event')
              .where({ employee_id: row.employee_id })
              .orderBy('id', 'desc')
              .first();
            if (
              last &&
              last.event_type !== 'OUT' &&
              day(last.attendance_date) === day(row.attendance_date)
            ) {
              await trx('att_punch_event').insert({
                employee_id: row.employee_id,
                event_type: 'OUT',
                event_at_utc: new Date(),
                attendance_date: day(row.attendance_date),
                timezone: last.timezone,
                source: 'MANUAL',
                correlation_id: 'regularization-' + row.id,
              });
            }
            const existing = await trx('att_daily_summary')
              .where({
                employee_id: row.employee_id,
                attendance_date: data.attendance_date,
              })
              .first();
            if (existing)
              await trx('att_daily_summary')
                .where({ id: existing.id })
                .update({ ...data, version_no: existing.version_no + 1 });
            else await trx('att_daily_summary').insert(data);
          }
        } else if (w.module === 'exit' && action === 'approved') {
          await trx('exit_case')
            .where({ id: row.id })
            .update({ approved_lwd: row.requested_lwd });
          await trx('exit_clearance_item').insert(
            [
              'Handover',
              'Assets',
              'Documents',
              'Attendance and Leave',
              'Final Payroll',
            ].map((title) => ({ exit_case_id: row.id, title }))
          );
        }
        await trx(table).where({ id: row.id }).update({ status: action });
        await trx('wf_instance').where({ id: w.id }).update({ status: action });
        await trx('wf_action').insert({
          workflow_id: w.id,
          actor_id: uid(req),
          action,
          comment: req.body.comment
            ? text(req.body.comment, 'Comment', 2000)
            : null,
        });
        await audit(trx, req, w.module, action, row.id);
        await notify(trx, req, w.employee_id, 'Your HR request was ' + action);
      });
      ok(res, { saved: true });
    })
  );
};
