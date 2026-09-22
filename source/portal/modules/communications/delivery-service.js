'use strict';
const profileOf = (user) => {
  try {
    return typeof user.profile === 'string'
      ? JSON.parse(user.profile)
      : user.profile || {};
  } catch {
    return {};
  }
};
const channels = (user) => {
  const p = profileOf(user),
    prefs = p.deliveryPreferences || {};
  return [
    prefs.email === true && user.email ? 'email' : null,
    prefs.sms === true && /^\+[1-9]\d{7,14}$/.test(p.mobile || '')
      ? 'sms'
      : null,
  ].filter(Boolean);
};
exports.enqueue = async (trx, notificationId, employeeId) => {
  const user = await trx('employees')
    .where({ userId: employeeId, status: 1 })
    .first();
  if (!user) return;
  const rows = channels(user).map((channel) => ({
    notification_id: notificationId,
    employee_id: employeeId,
    channel,
  }));
  if (rows.length) await trx('notification_delivery').insert(rows);
};
exports.runBatch = async ({ db, sendEmail, sendSms, limit = 20 }) => {
  // A process failure after provider acceptance is ambiguous. Never resend automatically.
  await db('notification_delivery')
    .where({ status: 'processing' })
    .where('updated_at', '<', new Date(Date.now() - 300000))
    .update({
      status: 'unknown',
      error_code: 'PROCESS_INTERRUPTED',
      updated_at: db.fn.now(),
    });
  const counts = { accepted: 0, failed: 0, unknown: 0, skipped: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await db.transaction(async (trx) => {
      const row = await trx('notification_delivery')
        .where({ status: 'queued' })
        .orderBy('id')
        .forUpdate()
        .first();
      if (!row) return null;
      await trx('notification_delivery')
        .where({ id: row.id })
        .update({
          status: 'processing',
          attempts: row.attempts + 1,
          updated_at: trx.fn.now(),
        });
      return row;
    });
    if (!job) break;
    let update;
    try {
      const user = await db('employees')
        .where({ userId: job.employee_id, status: 1 })
        .first();
      if (!user || !channels(user).includes(job.channel)) {
        update = { status: 'skipped', error_code: 'PREFERENCE_DISABLED' };
      } else {
        const message = {
          to: job.channel === 'email' ? user.email : profileOf(user).mobile,
          subject: 'MiNi HRMS workspace update',
          text: 'An update is available in your MiNi HRMS workspace. Sign in to review it.',
        };
        const send = job.channel === 'email' ? sendEmail : sendSms;
        if (!send) {
          update = { status: 'failed', error_code: 'PROVIDER_NOT_CONFIGURED' };
        } else {
          const result = await send(message);
          update = {
            status: 'accepted',
            provider_id: String((result && result.id) || '').slice(0, 100),
            error_code: null,
          };
        }
      }
    } catch (e) {
      update = {
        status: e.definite ? 'failed' : 'unknown',
        error_code: e.definite ? 'PROVIDER_REJECTED' : 'DELIVERY_UNCERTAIN',
      };
    }
    await db('notification_delivery')
      .where({ id: job.id, status: 'processing' })
      .update({ ...update, updated_at: db.fn.now() });
    counts[update.status]++;
  }
  return counts;
};
