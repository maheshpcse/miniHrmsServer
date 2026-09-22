'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  activeJobs,
  audit,
  choice,
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
  r,
  scoped,
  text,
  today,
  uid,
  wrap,
}) => {
  r.post(
    '/assignments',
    wrap(async (req, res) => {
      need(req);
      const b = req.body,
        id = number(b.employee_id, 'Employee'),
        boss = b.manager_id ? number(b.manager_id, 'Manager') : null,
        effective = date(b.effective_from);
      if (effective > today())
        fail(
          400,
          'Future assignments must be scheduled when their effective date arrives.'
        );
      await db.transaction(async (trx) => {
        const o = await org(trx);
        await person(trx, id);
        if (boss) await person(trx, boss);
        if (id === boss) fail(400, 'An employee cannot report to themselves.');
        const jobs = await activeJobs(trx);
        let cursor = boss;
        const seen = new Set([id]);
        while (cursor) {
          if (seen.has(cursor))
            fail(400, 'This reporting change would create a cycle.');
          seen.add(cursor);
          const j = jobs.find((x) => x.employee_id === cursor);
          cursor = j && j.manager_id;
        }
        const old = jobs.find((j) => j.employee_id === id);
        if (old && day(old.effective_from) >= effective)
          fail(
            409,
            'Choose an effective date after the current assignment starts.'
          );
        if (old) {
          const end = new Date(effective);
          end.setUTCDate(end.getUTCDate() - 1);
          await trx('emp_job_assignment')
            .where({ id: old.id })
            .update({ effective_to: day(end) });
        }
        const [row] = await trx('emp_job_assignment').insert({
          employee_id: id,
          manager_id: boss,
          organization_id: o.id,
          department: text(b.department, 'Department', 100),
          designation: text(b.designation, 'Designation', 100),
          location: b.location ? text(b.location, 'Location', 100) : null,
          employment_type: choice(
            b.employment_type,
            ['Permanent', 'Contract', 'Intern'],
            'employment type'
          ),
          effective_from: effective,
          created_by: uid(req),
        });
        await audit(trx, req, 'employees', 'assignment', row);
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/assignments',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          (
            await scoped(
              req,
              db('emp_job_assignment')
                .whereNot('employee_id', uid(req))
                .orderBy('id', 'desc')
            )
          ).query,
          ['department', 'designation']
        )
      )
    )
  );
  r.get(
    '/onboarding',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          (
            await scoped(req, db('emp_onboarding_task').orderBy('id', 'desc'))
          ).query,
          ['title']
        )
      )
    )
  );
  r.post(
    '/onboarding',
    wrap(async (req, res) => {
      need(req);
      const b = req.body;
      await person(db, b.employee_id);
      const [id] = await db('emp_onboarding_task').insert({
        employee_id: b.employee_id,
        area: choice(
          b.area,
          [
            'Identity',
            'Job',
            'Access',
            'Attendance',
            'Leave',
            'Payroll',
            'Tax',
            'Documents',
            'Notifications',
          ],
          'area'
        ),
        title: text(b.title, 'Task'),
        due_date: b.due_date ? date(b.due_date) : null,
        created_by: uid(req),
      });
      ok(res, { id });
    })
  );
  r.post(
    '/onboarding/:id/complete',
    wrap(async (req, res) => {
      await db.transaction(async (trx) => {
        const row = await trx('emp_onboarding_task')
          .where({ id: number(req.params.id, 'Task') })
          .forUpdate()
          .first();
        if (!row) fail(404, 'Task not found.');
        if (!hr(req) && row.employee_id !== uid(req))
          fail(403, 'This is not your task.');
        await trx('emp_onboarding_task')
          .where({ id: row.id })
          .update({ status: 'completed' });
        await audit(trx, req, 'employees', 'task_completed', row.id);
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/employee-details',
    wrap(async (req, res) => {
      const q = db('emp_detail_record').orderBy('id', 'desc');
      if (!hr(req)) q.where({ employee_id: uid(req) });
      else
        q.whereNot('employee_id', uid(req)).whereNotIn(
          'employee_id',
          db('employees').select('userId').where('roleName', 'admin')
        );
      ok(res, await list(req, q, ['title']));
    })
  );
  r.post(
    '/employee-details',
    wrap(async (req, res) => {
      const b = req.body,
        id = hr(req) ? number(b.employee_id, 'Employee') : uid(req);
      await person(db, id);
      const kind = choice(
        b.kind,
        [
          'Emergency Contact',
          'Skill',
          'Qualification',
          'Asset',
          'Status Change',
        ],
        'detail type'
      );
      if (['Asset', 'Status Change'].includes(kind)) need(req);
      const [row] = await db('emp_detail_record').insert({
        employee_id: id,
        kind,
        title: text(b.title, 'Title'),
        detail: text(b.detail, 'Detail', 4000),
        effective_from: b.effective_from ? date(b.effective_from) : null,
        created_by: uid(req),
      });
      ok(res, { id: row });
    })
  );
};
