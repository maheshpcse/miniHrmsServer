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
  policy,
  r,
  scoped,
  text,
  today,
  uid,
  workflow,
  wrap,
}) => {
  r.get(
    '/exit',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          (
            await scoped(req, db('exit_case').orderBy('id', 'desc'))
          ).query,
          ['reason', 'status']
        )
      )
    )
  );
  r.post(
    '/exit',
    wrap(async (req, res) => {
      const b = req.body,
        lwd = date(b.requested_lwd);
      if (lwd < today()) fail(400, 'Last working day cannot be in the past.');
      await db.transaction(async (trx) => {
        await org(trx);
        const exitPolicy = await policy(trx, 'Exit');
        const minimum = new Date(today());
        minimum.setUTCDate(
          minimum.getUTCDate() + Number(exitPolicy.notice_days || 0)
        );
        if (lwd < day(minimum))
          fail(
            400,
            'The last working day is earlier than the configured notice period.'
          );
        if (
          await trx('exit_case')
            .where({ employee_id: uid(req) })
            .whereIn('status', ['pending', 'approved'])
            .first()
        )
          fail(409, 'An exit case is already open.');
        const [id] = await trx('exit_case').insert({
          employee_id: uid(req),
          resignation_date: today(),
          requested_lwd: lwd,
          reason: text(b.reason, 'Reason', 2000),
        });
        await workflow(trx, req, 'exit', id);
      });
      ok(res, { submitted: true });
    })
  );
  r.get(
    '/exit/:id/clearance',
    wrap(async (req, res) => {
      const e = await db('exit_case')
        .where({ id: number(req.params.id, 'Exit case') })
        .first();
      if (!e || (!hr(req) && e.employee_id !== uid(req)))
        fail(404, 'Exit case not found.');
      ok(res, {
        list: await db('exit_clearance_item').where({ exit_case_id: e.id }),
        case: e,
      });
    })
  );
  r.post(
    '/exit/:id/close',
    wrap(async (req, res) => {
      need(req);
      await db.transaction(async (trx) => {
        await org(trx);
        const e = await trx('exit_case')
          .where({ id: number(req.params.id, 'Exit case') })
          .forUpdate()
          .first();
        if (!e || e.status !== 'approved')
          fail(409, 'An approved exit case is required.');
        if (day(e.approved_lwd) > today())
          fail(
            409,
            'Access can only be closed on or after the approved last working day.'
          );
        if (
          await trx('exit_clearance_item')
            .where({ exit_case_id: e.id })
            .whereNot({ status: 'completed' })
            .first()
        )
          fail(409, 'Complete all clearances first.');
        if (e.employee_id === uid(req))
          fail(403, 'Another HR operator must close your exit.');
        await trx('exit_case').where({ id: e.id }).update({ status: 'closed' });
        await trx('employees')
          .where({ userId: e.employee_id })
          .update({ status: 0 });
        await trx('portal_sessions')
          .where({ userId: e.employee_id })
          .whereNull('revokedAt')
          .update({ revokedAt: new Date() });
        await audit(trx, req, 'exit', 'closed_access_revoked', e.id);
      });
      ok(res, { saved: true });
    })
  );
};
