'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  db,
  fail,
  instant,
  list,
  need,
  notify,
  number,
  ok,
  org,
  person,
  r,
  team,
  text,
  uid,
  wrap,
}) => {
  r.get(
    '/notices',
    wrap(async (req, res) => {
      const q = db('notice as n')
        .join('notice_recipient as p', 'p.notice_id', 'n.id')
        .where('p.employee_id', uid(req))
        .where('n.publish_at', '<=', new Date())
        .where(function () {
          this.whereNull('n.expires_at').orWhere(
            'n.expires_at',
            '>',
            new Date()
          );
        })
        .select('n.*', 'p.read_at', 'p.acknowledged_at')
        .orderBy('n.id', 'desc');
      ok(res, await list(req, q, ['n.title', 'n.body']));
    })
  );
  r.get(
    '/notices/sent',
    wrap(async (req, res) =>
      ok(
        res,
        await list(
          req,
          db('notice')
            .where({ created_by: uid(req) })
            .orderBy('id', 'desc'),
          ['title']
        )
      )
    )
  );
  r.post(
    '/notices',
    wrap(async (req, res) => {
      const b = req.body,
        audience = choice(
          b.audience,
          ['company', 'team', 'personal'],
          'audience'
        );
      if (audience === 'company') need(req);
      const ids =
        audience === 'company'
          ? (await db('employees').where({ status: 1 }).select('userId')).map(
              (e) => e.userId
            )
          : audience === 'team'
          ? (await team(req)).filter((id) => id !== uid(req))
          : [number(b.recipient_id, 'Recipient')];
      if (!ids.length) fail(400, 'No recipients match this audience.');
      const publish = b.publish_at
          ? instant(b.publish_at, 'Publish date')
          : new Date(),
        expiry = b.expires_at ? instant(b.expires_at, 'Expiry') : null;
      if (expiry && expiry <= publish)
        fail(400, 'Expiry must be after publication.');
      await db.transaction(async (trx) => {
        await org(trx);
        for (const id of ids) await person(trx, id);
        const [id] = await trx('notice').insert({
          title: text(b.title, 'Title'),
          body: text(b.body, 'Message', 8000),
          audience,
          recipient_id: audience === 'personal' ? ids[0] : null,
          publish_at: publish,
          expires_at: expiry,
          ack_required: b.ack_required === true,
          created_by: uid(req),
        });
        await trx('notice_recipient').insert(
          ids.map((employee_id) => ({ notice_id: id, employee_id }))
        );
        if (publish <= new Date())
          for (const employee of ids)
            await notify(
              trx,
              req,
              employee,
              'A new workplace message is available'
            );
        await audit(trx, req, 'notices', 'created', id, {
          recipients: ids.length,
        });
      });
      ok(res, { saved: true, recipients: ids.length });
    })
  );
  r.post(
    '/notices/:id/read',
    wrap(async (req, res) => {
      const id = number(req.params.id, 'Notice');
      const n = await db('notice')
        .where({ id })
        .where('publish_at', '<=', new Date())
        .first();
      if (!n) fail(404, 'Notice not found.');
      const changes = { read_at: new Date() };
      if (req.body.acknowledge === true) changes.acknowledged_at = new Date();
      if (
        !(await db('notice_recipient')
          .where({ notice_id: id, employee_id: uid(req) })
          .update(changes))
      )
        fail(404, 'Notice not found.');
      ok(res, { saved: true });
    })
  );
  r.get(
    '/deliveries',
    wrap(async (req, res) => {
      need(req);
      ok(
        res,
        await list(
          req,
          db('notification_delivery')
            .select(
              'id',
              'notification_id',
              'channel',
              'status',
              'attempts',
              'error_code',
              'created_at'
            )
            .orderBy('id', 'desc'),
          ['channel', 'status']
        )
      );
    })
  );
};
