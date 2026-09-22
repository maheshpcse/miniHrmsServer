'use strict';
module.exports = (platform) => {
  const { r, wrap, ok } = platform,
    service = require('./service')(platform);
  r.get(
    '/context',
    wrap(async (req, res) => ok(res, await service.context(req)))
  );
  r.get(
    '/hierarchy',
    wrap(async (req, res) => ok(res, await service.hierarchy(req)))
  );
};
