'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({ db, list, need, ok, r, wrap }) => {
  r.get(
    '/audit',
    wrap(async (req, res) => {
      need(req);
      ok(
        res,
        await list(req, db('audit_log').orderBy('id', 'desc'), [
          'module',
          'action',
        ])
      );
    })
  );
};
