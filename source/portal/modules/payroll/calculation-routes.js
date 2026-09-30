'use strict';
module.exports = (p) => {
  const {
      r,
      wrap,
      ok,
      db,
      need,
      uid,
      text,
      number,
      date,
      fail,
      parse,
      org,
      person,
      audit,
      digest,
      list,
    } = p,
    engine = require('./calculator');
  const period = (v) => {
    if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v))
      fail(400, 'Choose a payroll month.');
    return v;
  };
  const safeDate = (v) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  r.get(
    '/payroll/settings',
    wrap(async (req, res) => {
      need(req, 'payroll');
      ok(res, {
        policies: await db('pay_tax_policy').orderBy('id', 'desc').limit(200),
        compensation: await db('pay_compensation as c')
          .join('employees as e', 'e.userId', 'c.employee_id')
          .select('c.*', 'e.firstName', 'e.lastName', 'e.empId')
          .orderBy('c.id', 'desc')
          .limit(200),
      });
    })
  );
  r.post(
    '/payroll/tax-policies',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const b = req.body,
        country = text(b.country, 'Country code', 2).toUpperCase(),
        currency = text(b.currency, 'Currency', 3).toUpperCase(),
        from = date(b.effective_from),
        to = date(b.effective_to);
      if (
        !/^[A-Z]{2}$/.test(country) ||
        !/^[A-Z]{3}$/.test(currency) ||
        to < from
      )
        fail(400, 'Check country, currency and effective dates.');
      const rules = engine.validateRules(b.rules);
      const [id] = await db('pay_tax_policy').insert({
        name: text(b.name, 'Policy name', 150),
        country,
        region: text(b.region, 'State or region', 80),
        tax_year: text(b.tax_year, 'Tax year', 20),
        currency,
        effective_from: from,
        effective_to: to,
        rules: JSON.stringify(rules),
        source_reference: text(
          b.source_reference,
          'Rule source and scope',
          2000
        ),
        created_by: uid(req),
      });
      await audit(db, req, 'payroll', 'tax_policy_created', id);
      ok(res, { id });
    })
  );
  r.post(
    '/payroll/tax-policies/:id/activate',
    wrap(async (req, res) => {
      need(req, 'payroll');
      if (req.body.reviewed !== true)
        fail(400, 'Review the jurisdiction settings before activation.');
      const id = number(req.params.id, 'Tax policy');
      await db.transaction(async (trx) => {
        const row = await trx('pay_tax_policy')
          .where({ id })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Tax policy not found.');
        if (row.status !== 'draft')
          fail(409, 'This version has already been activated.');
        await trx('pay_tax_policy')
          .where({ id })
          .update({ status: 'active', activated_by: uid(req) });
        await audit(trx, req, 'payroll', 'tax_policy_activated', id);
      });
      ok(res, { saved: true });
    })
  );
  r.post(
    '/payroll/compensation',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const b = req.body,
        id = number(b.employee_id, 'Employee'),
        policyId = number(b.tax_policy_id, 'Tax policy'),
        effective = date(b.effective_from);
      const employee = await person(db, id);
      if (employee.roleName === 'admin' || employee.status !== 1)
        fail(400, 'Choose an active employee account.');
      const policy = await db('pay_tax_policy')
        .where({ id: policyId, status: 'active' })
        .first();
      if (!policy) fail(400, 'Activate a tax policy first.');
      if (
        effective < safeDate(policy.effective_from) ||
        effective > safeDate(policy.effective_to)
      )
        fail(400, 'Effective date must fall within the tax-policy version.');
      const components = engine.validateComponents(b.components);
      const [row] = await db('pay_compensation').insert({
        employee_id: id,
        tax_policy_id: policyId,
        currency: policy.currency,
        effective_from: effective,
        components: JSON.stringify(components),
        created_by: uid(req),
      });
      await audit(db, req, 'payroll', 'compensation_version_created', row);
      ok(res, { id: row });
    })
  );
  r.get(
    '/payroll/runs',
    wrap(async (req, res) => {
      need(req, 'payroll');
      ok(
        res,
        await list(
          req,
          db('pay_run as r')
            .join('employees as e', 'e.userId', 'r.employee_id')
            .select(
              'r.id',
              'r.period',
              'r.status',
              'r.employee_id',
              'r.created_at',
              'r.created_by',
              'r.reviewed_by',
              'r.result_id',
              'e.firstName',
              'e.lastName'
            )
            .orderBy('r.id', 'desc'),
          ['r.period', 'r.status', 'e.firstName', 'e.lastName']
        )
      );
    })
  );
  r.get(
    '/payroll/runs/:id',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const row = await db('pay_run')
        .where({ id: number(req.params.id, 'Payroll run') })
        .first();
      if (!row) fail(404, 'Payroll run not found.');
      row.result = parse(row.result);
      row.input_snapshot = parse(row.input_snapshot);
      res.set('Cache-Control', 'no-store');
      ok(res, row);
    })
  );
  r.post(
    '/payroll/runs',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const b = req.body,
        month = period(b.period),
        id = number(b.employee_id, 'Employee');
      const result = await db.transaction(async (trx) => {
        await org(trx);
        const employee = await person(trx, id);
        if (employee.roleName === 'admin' || employee.status !== 1)
          fail(400, 'Choose an active employee.');
        if (
          await trx('payroll_result')
            .where({ employee_id: id, period: month })
            .first()
        )
          fail(409, 'This month is already finalized.');
        if (
          await trx('pay_run')
            .where({ employee_id: id, period: month })
            .whereIn('status', ['draft', 'reviewed'])
            .first()
        )
          fail(409, 'Review or cancel the existing draft first.');
        const days = new Date(
            Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)
          ).getUTCDate(),
          end = month + '-' + String(days).padStart(2, '0');
        const comp = await trx('pay_compensation')
          .where({ employee_id: id })
          .where('effective_from', '<=', month + '-01')
          .orderBy('effective_from', 'desc')
          .orderBy('id', 'desc')
          .first();
        if (!comp)
          fail(
            400,
            'Configure compensation effective on or before the first day of this month.'
          );
        const policy = await trx('pay_tax_policy')
          .where({ id: comp.tax_policy_id, status: 'active' })
          .first();
        if (
          !policy ||
          end < safeDate(policy.effective_from) ||
          end > safeDate(policy.effective_to)
        )
          fail(400, 'No applicable active tax policy covers this pay date.');
        const attendance = await trx('att_payroll_summary as s')
          .join('att_period_lock as l', 'l.id', 's.lock_id')
          .where({ 's.employee_id': id, 'l.period': month })
          .select('s.*', 'l.period')
          .first();
        if (!attendance)
          fail(400, 'Lock attendance inputs for this completed month first.');
        const paidDays = number(b.paid_days, 'Paid days', 0, days);
        const ytdGross = text(b.ytd_gross || '0', 'Year-to-date gross', 30),
          ytdTax = text(b.ytd_tax || '0', 'Year-to-date income tax', 30);
        const to = safeDate(policy.effective_to),
          remaining = Math.min(
            11,
            Math.max(
              0,
              (Number(to.slice(0, 4)) - Number(month.slice(0, 4))) * 12 +
                Number(to.slice(5, 7)) -
                Number(month.slice(5))
            )
          );
        const calculation = engine.calculate({
          components: parse(comp.components),
          rules: parse(policy.rules),
          paidDays,
          periodDays: days,
          ytdGross,
          ytdTax,
          remainingMonths: remaining,
        });
        const snapshot = {
          compensation: comp,
          tax_policy: policy,
          attendance,
          paid_days: paidDays,
          period_days: days,
          ytd_gross: ytdGross,
          ytd_tax: ytdTax,
          input_note: text(b.input_note, 'Input review note', 2000),
        };
        const checksum = engine.fingerprint({ calculation, snapshot });
        const [run] = await trx('pay_run').insert({
          employee_id: id,
          period: month,
          compensation_id: comp.id,
          input_snapshot: JSON.stringify(snapshot),
          result: JSON.stringify(calculation),
          checksum,
          created_by: uid(req),
        });
        await audit(trx, req, 'payroll', 'draft_calculated', run);
        return { id: run };
      });
      ok(res, result);
    })
  );
  r.post(
    '/payroll/runs/:id/:action',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const id = number(req.params.id, 'Payroll run'),
        action = req.params.action;
      if (!['review', 'finalize', 'cancel'].includes(action))
        fail(400, 'Choose a valid payroll action.');
      const result = await db.transaction(async (trx) => {
        await org(trx);
        const run = await trx('pay_run').where({ id }).forUpdate().first();
        if (!run) fail(404, 'Payroll run not found.');
        if (action === 'cancel') {
          if (!['draft', 'reviewed'].includes(run.status))
            fail(409, 'Only open drafts may be cancelled.');
          await trx('pay_run').where({ id }).update({ status: 'cancelled' });
          await audit(trx, req, 'payroll', 'draft_cancelled', id);
          return { saved: true };
        }
        if (action === 'review') {
          if (run.status !== 'draft')
            fail(409, 'Only draft runs can be reviewed.');
          if (run.created_by === uid(req))
            fail(403, 'A different payroll user must review this draft.');
          await trx('pay_run')
            .where({ id })
            .update({ status: 'reviewed', reviewed_by: uid(req) });
          await audit(trx, req, 'payroll', 'draft_reviewed', id);
          return { saved: true };
        }
        if (run.status === 'finalized')
          return { id: run.result_id, replayed: true };
        if (run.status !== 'reviewed')
          fail(409, 'Review the draft before finalizing.');
        if (
          await trx('payroll_result')
            .where({ employee_id: run.employee_id, period: run.period })
            .first()
        )
          fail(409, 'A finalized result already exists for this month.');
        const calc = parse(run.result),
          snapshot = parse(run.input_snapshot);
        if (
          engine.fingerprint({ calculation: calc, snapshot }) !== run.checksum
        )
          fail(409, 'Payroll snapshot integrity check failed.');
        const canonical = {
          employee_id: run.employee_id,
          period: run.period,
          currency: snapshot.compensation.currency,
          external_reference: 'HRMS-RUN-' + id,
          source_system: 'HRMS configured monthly calculator',
          gross: calc.gross,
          deductions: calc.deductions,
          tax: calc.tax,
          reimbursements: calc.reimbursements,
          employer_contributions: calc.employer_contributions,
          net: calc.net,
          components: JSON.stringify(calc.components),
          input_snapshot: JSON.stringify(snapshot),
          checksum: run.checksum,
          imported_by: uid(req),
        };
        const [resultId] = await trx('payroll_result').insert(canonical);
        await trx('payroll_result_component').insert(
          calc.components.map((c) => ({ ...c, result_id: resultId }))
        );
        const taxLines = calc.components
          .filter((c) => c.type === 'TAX')
          .map((c) => ({
            result_id: resultId,
            code: c.code,
            amount: c.amount,
          }));
        if (taxLines.length) await trx('payroll_result_tax').insert(taxLines);
        await trx('pay_run')
          .where({ id })
          .update({
            status: 'finalized',
            result_id: resultId,
            finalized_at: trx.fn.now(),
          });
        await audit(trx, req, 'payroll', 'run_finalized', id);
        return { id: resultId };
      });
      ok(res, result);
    })
  );
  r.get(
    '/payroll/inputs',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const id = number(req.query.employee_id, 'Employee'),
        month = period(req.query.period);
      const row = await db('att_payroll_summary as s')
        .join('att_period_lock as l', 'l.id', 's.lock_id')
        .where({ 's.employee_id': id, 'l.period': month })
        .select('s.*', 'l.period')
        .first();
      if (!row)
        fail(400, 'This employee/month has no locked attendance inputs.');
      const days = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)
      ).getUTCDate();
      ok(res, {
        period: month,
        worked_minutes: row.worked_minutes,
        unpaid_leave_days: row.unpaid_leave_days,
        period_days: days,
        suggested_paid_days: Math.max(
          0,
          days - Number(row.unpaid_leave_days || 0)
        ),
      });
    })
  );
  r.get(
    '/payroll/tax-register',
    wrap(async (req, res) => {
      need(req, 'payroll');
      ok(
        res,
        await list(
          req,
          db('payroll_result_tax as t')
            .join('payroll_result as p', 'p.id', 't.result_id')
            .join('employees as e', 'e.userId', 'p.employee_id')
            .select(
              't.id',
              't.code',
              't.amount',
              'p.period',
              'p.currency',
              'e.firstName',
              'e.lastName'
            )
            .orderBy('t.id', 'desc'),
          ['e.firstName', 'e.lastName', 'p.period', 't.code']
        )
      );
    })
  );
};
