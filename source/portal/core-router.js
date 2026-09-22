'use strict';
// Composition root: stable HTTP contracts with separately owned modules.
module.exports = (dependencies) => {
  const platform = require('./shared/platform')(dependencies);
  require('./modules/organization/routes')(platform);
  require('./modules/people/routes')(platform);
  require('./modules/leave/routes')(platform);
  require('./modules/policies/routes')(platform);
  require('./modules/attendance/routes')(platform);
  require('./modules/approvals/routes')(platform);
  require('./modules/payroll/routes')(platform);
  require('./modules/documents/routes')(platform);
  require('./modules/communications/routes')(platform);
  require('./modules/events/routes')(platform);
  require('./modules/engagement/routes')(platform);
  require('./modules/exit/routes')(platform);
  require('./modules/audit/routes')(platform);
  return platform.r;
};
