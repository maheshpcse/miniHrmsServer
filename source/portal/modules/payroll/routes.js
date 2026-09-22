'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  day,
  db,
  decimal,
  digest,
  fail,
  hr,
  list,
  money,
  need,
  notify,
  number,
  ok,
  org,
  payroll,
  person,
  r,
  text,
  today,
  uid,
  wrap,
}) => {
  r.get(
    '/payroll-inputs',
    wrap(async (req, res) => {
      if (!hr(req) && !payroll(req))
        fail(403, 'Payroll input access required.');
      ok(
        res,
        await list(
          req,
          db('att_payroll_summary as s')
            .join('att_period_lock as l', 'l.id', 's.lock_id')
            .select('s.*', 'l.period')
            .orderBy('s.id', 'desc'),
          ['l.period']
        )
      );
    })
  );
  r.post(
    '/payroll-inputs/lock',
    wrap(async (req, res) => {
      need(req);
      const period = text(req.body.period, 'Period', 7);
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) ||
        period >= today().slice(0, 7)
      )
        fail(400, 'Choose a completed month.');
      await db.transaction(async (trx) => {
        await org(trx);
        if (await trx('att_period_lock').where({ period }).first())
          fail(409, 'This month is already locked.');
        const start = period + '-01',
          end = day(
            new Date(
              Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)
            )
          );
        for (const table of [
          'att_regularization_request',
          'att_overtime_request',
        ])
          if (
            await trx(table)
              .where({ status: 'pending' })
              .whereBetween('attendance_date', [start, end])
              .first()
          )
            fail(409, 'Resolve pending attendance requests first.');
        if (
          await trx('lv_request')
            .where({ status: 'pending' })
            .where('start_date', '<=', end)
            .where('end_date', '>=', start)
            .first()
        )
          fail(409, 'Resolve pending leave first.');
        if (
          await trx('att_daily_summary')
            .where({ status: 'in_progress' })
            .whereBetween('attendance_date', [start, end])
            .first()
        )
          fail(409, 'Close incomplete attendance first.');
        const [lock] = await trx('att_period_lock').insert({
          period,
          locked_by: uid(req),
        });
        for (const employee of await trx('employees').select('userId')) {
          const [a] = await trx('att_daily_summary')
            .where({ employee_id: employee.userId })
            .whereBetween('attendance_date', [start, end])
            .sum('worked_minutes as minutes');
          const [o] = await trx('att_overtime_request')
            .where({ employee_id: employee.userId, status: 'approved' })
            .whereBetween('attendance_date', [start, end])
            .sum('minutes as minutes');
          const leaves = await trx('lv_request_day as d')
            .join('lv_request as r', 'r.id', 'd.request_id')
            .join('lv_leave_type as t', 't.id', 'r.leave_type_id')
            .where({ 'r.employee_id': employee.userId, 'r.status': 'approved' })
            .whereBetween('d.leave_date', [start, end])
            .select('d.units', 't.paid');
          const data = {
            employee_id: employee.userId,
            lock_id: lock,
            worked_minutes: Number(a.minutes || 0),
            overtime_minutes: Number(o.minutes || 0),
            paid_leave_days: leaves
              .filter((l) => l.paid)
              .reduce((s, l) => s + Number(l.units), 0),
            unpaid_leave_days: leaves
              .filter((l) => !l.paid)
              .reduce((s, l) => s + Number(l.units), 0),
          };
          await trx('att_payroll_summary').insert({
            ...data,
            source_checksum: digest(data),
          });
        }
        await audit(trx, req, 'attendance', 'period_locked', lock, { period });
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/salary',
    wrap(async (req, res) => {
      const q = db('payroll_result as r')
        .leftJoin('payroll_payslip as p', 'p.result_id', 'r.id')
        .select(
          'r.id',
          'r.employee_id',
          'r.external_reference',
          'r.period',
          'r.currency',
          'r.gross',
          'r.deductions',
          'r.tax',
          'r.net',
          'p.created_at as published_at'
        )
        .orderBy('r.id', 'desc');
      if (!payroll(req))
        q.where('r.employee_id', uid(req)).whereNotNull('p.id');
      ok(res, await list(req, q, ['r.period', 'r.external_reference']));
    })
  );
  r.get(
    '/salary/:id',
    wrap(async (req, res) => {
      const row = await db('payroll_result as r')
        .leftJoin('payroll_payslip as p', 'p.result_id', 'r.id')
        .select('r.*', 'p.created_at as published_at')
        .where('r.id', number(req.params.id, 'Payroll result'))
        .first();
      if (
        !row ||
        (!payroll(req) && (row.employee_id !== uid(req) || !row.published_at))
      )
        fail(404, 'Payslip not found.');
      row.components = await db('payroll_result_component')
        .where({ result_id: row.id })
        .select('code', 'name', 'type', 'amount', 'explanation');
      row.taxLines = await db('payroll_result_tax')
        .where({ result_id: row.id })
        .select('code', 'amount');
      row.employee = await db('employees')
        .where({ userId: row.employee_id })
        .select('empId', 'firstName', 'lastName')
        .first();
      delete row.input_snapshot;
      delete row.imported_by;
      await audit(db, req, 'salary', 'viewed', row.id);
      res.set('Cache-Control', 'no-store');
      ok(res, row);
    })
  );
  r.post(
    '/salary/import',
    wrap(async (req, res) => {
      need(req, 'payroll');
      const b = req.body;
      if (b.status !== 'FINALIZED')
        fail(400, 'Only FINALIZED payroll results may be imported.');
      const id = number(b.employee_id, 'Employee'),
        reference = text(b.external_reference, 'External reference', 100),
        period = text(b.period, 'Period', 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
        fail(400, 'Period must be YYYY-MM.');
      const currency = text(b.currency, 'Currency', 3).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency))
        fail(400, 'Use a three-letter currency code.');
      if (
        !Array.isArray(b.components) ||
        !b.components.length ||
        b.components.length > 100
      )
        fail(400, 'Provide 1 to 100 finalized component lines.');
      const codes = new Set(),
        totals = {
          EARNING: 0n,
          DEDUCTION: 0n,
          TAX: 0n,
          REIMBURSEMENT: 0n,
          EMPLOYER_CONTRIBUTION: 0n,
        };
      const components = b.components.map((line) => {
        const code = text(line.code, 'Component code', 50);
        if (codes.has(code)) fail(400, 'Duplicate component code.');
        codes.add(code);
        const type = choice(line.type, Object.keys(totals), 'component type'),
          amount = money(line.amount, 'Amount');
        totals[type] += amount;
        return {
          code,
          name: text(line.name, 'Component name', 150),
          type,
          amount: decimal(amount),
          explanation: line.explanation
            ? text(line.explanation, 'Explanation', 500)
            : null,
        };
      });
      const gross = money(b.gross, 'Gross'),
        deductions = money(b.deductions, 'Deductions'),
        tax = money(b.tax || '0', 'Tax'),
        reimbursements = money(b.reimbursements || '0', 'Reimbursements'),
        employer = money(
          b.employer_contributions || '0',
          'Employer contributions'
        ),
        net = money(b.net, 'Net');
      if (
        gross !== totals.EARNING ||
        deductions !== totals.DEDUCTION ||
        tax !== totals.TAX ||
        reimbursements !== totals.REIMBURSEMENT ||
        employer !== totals.EMPLOYER_CONTRIBUTION ||
        net !== gross + reimbursements - deductions - tax
      )
        fail(400, 'Finalized totals do not reconcile with component lines.');
      const source = text(b.source_system, 'Payroll source', 100);
      if (
        !b.input_snapshot ||
        typeof b.input_snapshot !== 'object' ||
        Array.isArray(b.input_snapshot)
      )
        fail(400, 'Provide the finalized input snapshot.');
      const canonical = {
          employee_id: id,
          external_reference: reference,
          period,
          currency,
          gross: decimal(gross),
          deductions: decimal(deductions),
          tax: decimal(tax),
          reimbursements: decimal(reimbursements),
          employer_contributions: decimal(employer),
          net: decimal(net),
          components,
          source_system: source,
          input_snapshot: b.input_snapshot,
        },
        checksum = digest(canonical);
      const result = await db.transaction(async (trx) => {
        await org(trx);
        await person(trx, id);
        const old = await trx('payroll_result')
          .where({ external_reference: reference })
          .first();
        if (old) {
          if (old.checksum !== checksum)
            fail(
              409,
              'This reference already contains different finalized results. Import an adjustment with a new reference.'
            );
          return { id: old.id, replayed: true };
        }
        if (
          await trx('payroll_result').where({ employee_id: id, period }).first()
        )
          fail(
            409,
            'A finalized result already exists for this employee and period. Payroll corrections require a separately modeled adjustment run.'
          );
        const [row] = await trx('payroll_result').insert({
          ...canonical,
          components: JSON.stringify(components),
          input_snapshot: JSON.stringify(b.input_snapshot),
          checksum,
          imported_by: uid(req),
        });
        await trx('payroll_result_component').insert(
          components.map((c) => ({ ...c, result_id: row }))
        );
        const taxes = components
          .filter((c) => c.type === 'TAX')
          .map((c) => ({ result_id: row, code: c.code, amount: c.amount }));
        if (taxes.length) await trx('payroll_result_tax').insert(taxes);
        await audit(trx, req, 'salary', 'finalized_import', row, {
          source,
          reference,
        });
        return { id: row };
      });
      ok(res, result);
    })
  );
  r.post(
    '/salary/:id/publish',
    wrap(async (req, res) => {
      need(req, 'payroll');
      await db.transaction(async (trx) => {
        const row = await trx('payroll_result')
          .where({ id: number(req.params.id, 'Payroll result') })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Payroll result not found.');
        if (
          !(await trx('payroll_payslip').where({ result_id: row.id }).first())
        ) {
          await trx('payroll_payslip').insert({
            result_id: row.id,
            published_by: uid(req),
          });
          await notify(trx, req, row.employee_id, 'Your payslip is available');
          await audit(trx, req, 'salary', 'published', row.id);
        }
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/salary-queries',
    wrap(async (req, res) => {
      const q = db('salary_query').orderBy('id', 'desc');
      if (!payroll(req)) q.where({ employee_id: uid(req) });
      ok(res, await list(req, q, ['subject', 'status']));
    })
  );
  r.post(
    '/salary-queries',
    wrap(async (req, res) => {
      const id = number(req.body.result_id, 'Payslip');
      const result = await db('payroll_result as r')
        .join('payroll_payslip as p', 'p.result_id', 'r.id')
        .where({ 'r.id': id, 'r.employee_id': uid(req) })
        .first();
      if (!result) fail(404, 'Published payslip not found.');
      const [row] = await db('salary_query').insert({
        employee_id: uid(req),
        result_id: id,
        subject: text(req.body.subject, 'Subject'),
        description: text(req.body.description, 'Description', 2000),
      });
      ok(res, { id: row });
    })
  );
  r.post(
    '/salary-queries/:id/reply',
    wrap(async (req, res) => {
      need(req, 'payroll');
      await db.transaction(async (trx) => {
        const row = await trx('salary_query')
          .where({ id: number(req.params.id, 'Query') })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Query not found.');
        await trx('salary_query')
          .where({ id: row.id })
          .update({
            reply: text(req.body.reply, 'Reply', 2000),
            status: 'resolved',
          });
        await notify(
          trx,
          req,
          row.employee_id,
          'Your payroll query has an update'
        );
        await audit(trx, req, 'salary', 'query_replied', row.id);
      });
      ok(res, { saved: true });
    })
  );
};
