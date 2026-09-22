'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  crypto,
  db,
  digest,
  fail,
  hr,
  instant,
  list,
  need,
  notify,
  number,
  ok,
  parse,
  person,
  r,
  secret,
  text,
  uid,
  wrap,
}) => {
  r.get(
    '/surveys',
    wrap(async (req, res) => {
      const results = await list(req, db('eng_survey').orderBy('id', 'desc'), [
        'title',
      ]);
      for (const s of results.list) {
        s.options = parse(s.options);
        const [n] = await db('eng_response')
          .where({ survey_id: s.id })
          .count('* as count');
        s.responses = Number(n.count);
        s.results =
          s.responses >= s.privacy_threshold
            ? await db('eng_response')
                .where({ survey_id: s.id })
                .select('answer')
                .count('* as count')
                .groupBy('answer')
            : null;
        s.responded = !!(await db('eng_response')
          .where({
            survey_id: s.id,
            participant_hash: crypto
              .createHmac('sha256', secret)
              .update(s.id + ':' + uid(req))
              .digest('hex'),
          })
          .first());
      }
      ok(res, results);
    })
  );
  r.post(
    '/surveys',
    wrap(async (req, res) => {
      need(req);
      const b = req.body,
        options = b.options;
      if (!Array.isArray(options) || options.length < 2 || options.length > 10)
        fail(400, 'Provide 2 to 10 answer options.');
      const close = instant(b.closes_at, 'Closing date');
      if (close <= new Date()) fail(400, 'Closing date must be in the future.');
      const [id] = await db('eng_survey').insert({
        title: text(b.title, 'Title'),
        question: text(b.question, 'Question', 2000),
        options: JSON.stringify(options.map((o) => text(o, 'Option', 150))),
        anonymous: b.anonymous !== false,
        privacy_threshold: number(
          b.privacy_threshold || 5,
          'Privacy threshold',
          5,
          100
        ),
        closes_at: close,
        created_by: uid(req),
      });
      ok(res, { id });
    })
  );
  r.post(
    '/surveys/:id/respond',
    wrap(async (req, res) => {
      await db.transaction(async (trx) => {
        const s = await trx('eng_survey')
          .where({ id: number(req.params.id, 'Survey') })
          .forUpdate()
          .first();
        if (!s || new Date(s.closes_at) <= new Date())
          fail(409, 'This survey is closed.');
        const answer = number(
            req.body.answer,
            'Answer',
            0,
            parse(s.options).length - 1
          ),
          hash = crypto
            .createHmac('sha256', secret)
            .update(s.id + ':' + uid(req))
            .digest('hex');
        if (
          await trx('eng_response')
            .where({ survey_id: s.id, participant_hash: hash })
            .first()
        )
          fail(409, 'You already responded.');
        await trx('eng_response').insert({
          survey_id: s.id,
          participant_hash: hash,
          employee_id: s.anonymous ? null : uid(req),
          answer,
        });
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/recognition',
    wrap(async (req, res) =>
      ok(
        res,
        await list(req, db('eng_recognition').orderBy('id', 'desc'), [
          'message',
          'category',
        ])
      )
    )
  );
  r.post(
    '/recognition',
    wrap(async (req, res) => {
      const b = req.body,
        id = number(b.employee_id, 'Recipient');
      await person(db, id);
      if (id === uid(req)) fail(400, 'Choose a colleague to recognize.');
      await db.transaction(async (trx) => {
        const [record] = await trx('eng_recognition').insert({
          employee_id: id,
          created_by: uid(req),
          category: text(b.category, 'Category', 50),
          message: text(b.message, 'Message', 2000),
        });
        await notify(trx, req, id, 'You received recognition');
        await audit(trx, req, 'engagement', 'recognition', record);
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/feedback',
    wrap(async (req, res) => {
      const q = db('eng_feedback').orderBy('id', 'desc');
      if (!hr(req)) q.where({ employee_id: uid(req) });
      ok(res, await list(req, q, ['title']));
    })
  );
  r.post(
    '/feedback',
    wrap(async (req, res) => {
      const [id] = await db('eng_feedback').insert({
        employee_id: uid(req),
        kind: choice(req.body.kind, ['Feedback', 'Idea'], 'kind'),
        title: text(req.body.title, 'Title'),
        description: text(req.body.description, 'Description', 4000),
      });
      ok(res, { id });
    })
  );
};
