'use strict';
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
if (process.env.NOTIFICATION_DELIVERY_ENABLED !== 'true') {
  console.log('Email/SMS delivery is disabled.');
  process.exit(0);
}
const { knex: db } = require('../source/configs/knex');
const providers =
  require('../source/portal/modules/communications/providers')();
const {
  runBatch,
} = require('../source/portal/modules/communications/delivery-service');
if (!providers.sendEmail && !providers.sendSms) {
  console.error('Configure an email or SMS provider before enabling delivery.');
  db.destroy().then(() => process.exit(1));
} else
  runBatch({ db, ...providers })
    .then((counts) => console.log('Notification delivery batch:', counts))
    .catch(() => {
      console.error(
        'Notification delivery failed. Check schema and provider settings.'
      );
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
