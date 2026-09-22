'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  date,
  day,
  db,
  fail,
  list,
  localDate,
  number,
  ok,
  org,
  policy,
  r,
  scoped,
  text,
  today,
  uid,
  unlocked,
  workflow,
  wrap,
}) => {
  r.get(
    '/attendance',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          (
            await scoped(
              req,
              db('att_daily_summary').orderBy('attendance_date', 'desc')
            )
          ).query,
          ['status']
        )
      )
    )
  );
  r.get(
    '/attendance/state',
    wrap(async (req, res) =>
      ok(res, {
        last:
          (await db('att_punch_event')
            .where({ employee_id: uid(req) })
            .orderBy('id', 'desc')
            .first()) || null,
      })
    )
  );
  r.post(
    '/attendance/punch',
    wrap(async (req, res) => {
      const type = choice(
          req.body.event_type,
          ['IN', 'OUT', 'BREAK_OUT', 'BREAK_IN'],
          'punch'
        ),
        key = text(req.body.correlation_id, 'Request reference', 64);
      const result = await db.transaction(async (trx) => {
        const o = await org(trx);
        await trx('employees')
          .where({ userId: uid(req) })
          .forUpdate()
          .first();
        const duplicate = await trx('att_punch_event')
          .where({ employee_id: uid(req), correlation_id: key })
          .first();
        if (duplicate) {
          if (duplicate.event_type !== type)
            fail(409, 'This request reference was already used.');
          return duplicate;
        }
        const last = await trx('att_punch_event')
          .where({ employee_id: uid(req) })
          .orderBy('id', 'desc')
          .first();
        const previous = last ? last.event_type : 'OUT';
        const allowed = {
          OUT: ['IN'],
          IN: ['OUT', 'BREAK_OUT'],
          BREAK_OUT: ['BREAK_IN'],
          BREAK_IN: ['OUT', 'BREAK_OUT'],
        };
        if (!allowed[previous].includes(type))
          fail(
            409,
            'This punch is not valid for your current attendance state.'
          );
        const attendancePolicy = await policy(trx, 'Attendance');
        const zone = attendancePolicy.timezone || o.timezone;
        const now = new Date(),
          d = type === 'IN' ? localDate(now, zone) : day(last.attendance_date);
        await unlocked(trx, d);
        if (
          await trx('att_daily_summary')
            .where({
              employee_id: uid(req),
              attendance_date: d,
              status: 'regularized',
            })
            .first()
        )
          fail(
            409,
            'This day has an approved correction. Contact HR before adding punches.'
          );
        if (
          last &&
          previous !== 'OUT' &&
          now - new Date(last.event_at_utc) > 36 * 3600000
        )
          fail(409, 'Your previous punch needs HR regularization.');
        const [id] = await trx('att_punch_event').insert({
          employee_id: uid(req),
          event_type: type,
          event_at_utc: now,
          attendance_date: d,
          timezone: zone,
          source: 'WEB',
          correlation_id: key,
        });
        const events = await trx('att_punch_event')
          .where({ employee_id: uid(req), attendance_date: d })
          .orderBy('id');
        let worked = 0,
          breaks = 0;
        for (let i = 1; i < events.length; i++) {
          const mins = Math.max(
            0,
            Math.floor(
              (new Date(events[i].event_at_utc) -
                new Date(events[i - 1].event_at_utc)) /
                60000
            )
          );
          if (['IN', 'BREAK_IN'].includes(events[i - 1].event_type))
            worked += mins;
          if (events[i - 1].event_type === 'BREAK_OUT') breaks += mins;
        }
        const summary = {
          worked_minutes: worked,
          break_minutes: breaks,
          status:
            type === 'OUT'
              ? attendancePolicy.full_day_minutes
                ? worked >= attendancePolicy.full_day_minutes
                  ? 'full_day'
                  : worked >= attendancePolicy.half_day_minutes
                  ? 'half_day'
                  : 'short_day'
                : 'complete'
              : 'in_progress',
        };
        const existing = await trx('att_daily_summary')
          .where({ employee_id: uid(req), attendance_date: d })
          .first();
        if (existing)
          await trx('att_daily_summary')
            .where({ id: existing.id })
            .update({ ...summary, version_no: existing.version_no + 1 });
        else
          await trx('att_daily_summary').insert({
            ...summary,
            employee_id: uid(req),
            attendance_date: d,
          });
        await audit(trx, req, 'attendance', 'punch_' + type, id);
        return { id, event_type: type };
      });
      ok(res, result);
    })
  );
  for (const [path, table] of [
    ['regularizations', 'att_regularization_request'],
    ['overtime', 'att_overtime_request'],
  ]) {
    r.get(
      '/' + path,
      wrap(async (req, res) =>
        ok(
          res,
          await list(
            req,
            (
              await scoped(req, db(table).orderBy('id', 'desc'))
            ).query,
            ['reason', 'status']
          )
        )
      )
    );
    r.post(
      '/' + path,
      wrap(async (req, res) => {
        const b = req.body,
          d = date(b.attendance_date);
        if (d > today())
          fail(400, 'Attendance requests cannot be future dated.');
        const data = {
          employee_id: uid(req),
          attendance_date: d,
          minutes: number(b.minutes, 'Minutes', 1, 1440),
          reason: text(b.reason, 'Reason', 2000),
        };
        await db.transaction(async (trx) => {
          await org(trx);
          await unlocked(trx, d);
          if (
            await trx(table)
              .where({
                employee_id: uid(req),
                attendance_date: d,
                status: 'pending',
              })
              .first()
          )
            fail(409, 'A request is already pending for this day.');
          const [id] = await trx(table).insert(data);
          await workflow(trx, req, path, id);
        });
        ok(res, { submitted: true });
      })
    );
  }
};
