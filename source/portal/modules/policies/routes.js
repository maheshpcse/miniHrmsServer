'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  date,
  db,
  fail,
  list,
  localDate,
  need,
  number,
  ok,
  org,
  r,
  text,
  uid,
  wrap,
}) => {
  r.get(
    '/policies',
    wrap(async (req, res) => {
      need(req);
      ok(
        res,
        await list(req, db('hr_policy').orderBy('id', 'desc'), [
          'name',
          'module',
        ])
      );
    })
  );
  r.post(
    '/policies',
    wrap(async (req, res) => {
      need(req);
      const b = req.body;
      const module = choice(
        b.module,
        ['Attendance', 'Leave', 'Exit'],
        'module'
      );
      let rules;
      if (module === 'Attendance') {
        const zone = text(b.timezone, 'Timezone', 64);
        try {
          localDate(new Date(), zone);
        } catch {
          fail(400, 'Invalid timezone.');
        }
        rules = {
          timezone: zone,
          full_day_minutes: number(
            b.full_day_minutes,
            'Full day minutes',
            1,
            1440
          ),
          half_day_minutes: number(
            b.half_day_minutes,
            'Half day minutes',
            1,
            1440
          ),
        };
        if (rules.half_day_minutes > rules.full_day_minutes)
          fail(400, 'Half day cannot exceed full day.');
      }
      if (module === 'Leave')
        rules = {
          weekend_policy: choice(
            b.weekend_policy,
            ['Saturday & Sunday', 'Sunday', 'No weekly offs'],
            'weekly offs'
          ),
        };
      if (module === 'Exit')
        rules = { notice_days: number(b.notice_days, 'Notice days', 0, 365) };
      await db.transaction(async (trx) => {
        const o = await org(trx);
        const [id] = await trx('hr_policy').insert({
          organization_id: o.id,
          module,
          name: text(b.name, 'Policy'),
          rules: JSON.stringify(rules),
          effective_from: date(b.effective_from),
          created_by: uid(req),
        });
        await audit(trx, req, module, 'policy_version_created', id);
      });
      ok(res, { saved: true });
    })
  );
};
