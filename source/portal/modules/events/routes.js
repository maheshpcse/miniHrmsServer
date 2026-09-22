'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  db,
  fail,
  hr,
  instant,
  list,
  localDate,
  need,
  notify,
  number,
  ok,
  person,
  r,
  text,
  uid,
  wrap,
}) => {
  r.get(
    '/events',
    wrap(async (req, res) => {
      const result = await list(
        req,
        db('evt_event').orderBy('starts_at', 'desc'),
        ['title', 'venue']
      );
      for (const e of result.list) {
        const [n] = await db('evt_rsvp')
          .where({ event_id: e.id, response: 'attending' })
          .count('* as n');
        e.attending = Number(n.n);
        const own = await db('evt_rsvp')
          .where({ event_id: e.id, employee_id: uid(req) })
          .first();
        e.response = own ? own.response : 'not_responded';
      }
      ok(res, result);
    })
  );
  r.post(
    '/events',
    wrap(async (req, res) => {
      need(req);
      const b = req.body,
        start = instant(b.starts_at, 'Start'),
        end = instant(b.ends_at, 'End');
      if (end <= start) fail(400, 'End must follow start.');
      const zone = text(b.timezone || 'Asia/Kolkata', 'Timezone', 64);
      try {
        localDate(start, zone);
      } catch {
        fail(400, 'Invalid timezone.');
      }
      await db.transaction(async (trx) => {
        const [id] = await trx('evt_event').insert({
          title: text(b.title, 'Title'),
          description: text(b.description, 'Description', 4000),
          starts_at: start,
          ends_at: end,
          timezone: zone,
          venue: text(b.venue, 'Venue'),
          capacity: number(b.capacity, 'Capacity', 1, 100000),
          created_by: uid(req),
        });
        await audit(trx, req, 'events', 'published', id);
      });
      ok(res, { saved: true });
    })
  );
  r.post(
    '/events/:id/rsvp',
    wrap(async (req, res) => {
      const response = choice(
        req.body.response,
        ['attending', 'declined'],
        'response'
      );
      await db.transaction(async (trx) => {
        const e = await trx('evt_event')
          .where({ id: number(req.params.id, 'Event') })
          .forUpdate()
          .first();
        if (!e || e.status !== 'published') fail(404, 'Event not available.');
        if (new Date(e.ends_at) < new Date())
          fail(409, 'This event has ended.');
        const old = await trx('evt_rsvp')
          .where({ event_id: e.id, employee_id: uid(req) })
          .first();
        const [n] = await trx('evt_rsvp')
          .where({ event_id: e.id, response: 'attending' })
          .count('* as n');
        const value =
          response === 'attending' &&
          (!old || old.response !== 'attending') &&
          Number(n.n) >= e.capacity
            ? 'waitlisted'
            : response;
        if (old)
          await trx('evt_rsvp')
            .where({ id: old.id })
            .update({ response: value });
        else
          await trx('evt_rsvp').insert({
            event_id: e.id,
            employee_id: uid(req),
            response: value,
          });
        await audit(trx, req, 'events', 'rsvp', e.id);
        await notify(trx, req, uid(req), 'Your event response is ' + value);
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/event-tasks',
    wrap(async (req, res) => {
      const q = db('evt_task').orderBy('id', 'desc');
      if (!hr(req)) q.where({ owner_id: uid(req) });
      ok(res, await list(req, q, ['title']));
    })
  );
  r.post(
    '/event-tasks',
    wrap(async (req, res) => {
      need(req);
      await person(db, req.body.owner_id);
      if (
        !(await db('evt_event')
          .where({ id: number(req.body.event_id, 'Event') })
          .first())
      )
        fail(404, 'Event not found.');
      const [id] = await db('evt_task').insert({
        event_id: req.body.event_id,
        owner_id: req.body.owner_id,
        title: text(req.body.title, 'Task'),
      });
      ok(res, { id });
    })
  );
  r.post(
    '/event-tasks/:id/complete',
    wrap(async (req, res) => {
      const q = db('evt_task').where({ id: number(req.params.id, 'Task') });
      if (!hr(req)) q.where({ owner_id: uid(req) });
      if (!(await q.update({ status: 'completed' })))
        fail(404, 'Task not found.');
      ok(res, { saved: true });
    })
  );
};
