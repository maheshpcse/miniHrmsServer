'use strict';
exports.runBatch = async ({ db, send, limit = 20 }) => {
  const subscriptions = await db('push_subscription as s')
    .join('employees as e', 'e.userId', 's.employee_id')
    .where({ 's.active': 1, 'e.status': 1 })
    .select('s.*', 'e.roleName')
    .orderBy('s.last_scan_at')
    .limit(limit);
  for (const sub of subscriptions)
    await db.transaction(async (trx) => {
      const current = await trx('push_subscription')
        .where({ id: sub.id, active: true })
        .forUpdate()
        .first();
      if (!current) return;
      const preference = await trx('portal_user_preferences')
        .where({ userId: current.employee_id })
        .first();
      const minimum = Math.max(
        Number(current.last_notification_id),
        Number((preference && preference.notificationsReadThrough) || 0)
      );
      const rows = await trx('portal_notifications')
        .where('id', '>', minimum)
        .where(function () {
          this.where('recipientId', current.employee_id).orWhere(function () {
            this.whereNull('recipientId').whereIn(
              'audience',
              sub.roleName === 'admin' ? ['all', 'admin'] : ['all']
            );
          });
        })
        .orderBy('id')
        .limit(50);
      if (rows.length) {
        await trx('push_delivery').insert(
          rows.map((row) => ({
            subscription_id: current.id,
            employee_id: current.employee_id,
            notification_id: row.id,
          }))
        );
      }
      const [last] = await trx('portal_notifications').max('id as id');
      await trx('push_subscription')
        .where({ id: current.id })
        .update({
          last_scan_at: trx.fn.now(),
          last_notification_id:
            rows.length === 50
              ? rows[rows.length - 1].id
              : Number(last.id) || minimum,
        });
    });
  await db('push_delivery')
    .where({ status: 'processing' })
    .where('updated_at', '<', new Date(Date.now() - 300000))
    .update({ status: 'unknown', updated_at: db.fn.now() });
  let accepted = 0;
  for (let i = 0; i < limit; i++) {
    const job = await db('push_delivery')
      .where({ status: 'queued' })
      .orderBy('id')
      .first();
    if (!job) break;
    const claimed = await db('push_delivery')
      .where({ id: job.id, status: 'queued' })
      .update({ status: 'processing', updated_at: db.fn.now() });
    if (!claimed) continue;
    const sub = await db('push_subscription as s')
      .join('employees as e', 'e.userId', 's.employee_id')
      .where({ 's.id': job.subscription_id, 's.active': 1, 'e.status': 1 })
      .select('s.*', 'e.roleName')
      .first();
    let status = 'skipped';
    if (sub && sub.employee_id === job.employee_id) {
      const notification = await db('portal_notifications')
          .where({ id: job.notification_id })
          .first(),
        pref = await db('portal_user_preferences')
          .where({ userId: job.employee_id })
          .first();
      const visible =
        notification &&
        (notification.recipientId === sub.employee_id ||
          (!notification.recipientId &&
            (notification.audience === 'all' ||
              (notification.audience === 'admin' &&
                sub.roleName === 'admin'))));
      if (
        visible &&
        Number((pref && pref.notificationsReadThrough) || 0) <
          job.notification_id
      ) {
        try {
          await send(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: 'MiNi HRMS',
              body: 'A workspace update is waiting. Sign in to review it.',
              notificationId: job.notification_id,
            })
          );
          status = 'accepted';
          accepted++;
        } catch (e) {
          status = 'unknown';
          if ([404, 410].includes(e.statusCode)) {
            status = 'expired';
            await db('push_subscription')
              .where({ id: sub.id })
              .update({ active: false });
          } else if (e.statusCode >= 400 && e.statusCode < 500)
            status = 'failed';
        }
      }
    }
    await db('push_delivery')
      .where({ id: job.id })
      .update({ status, updated_at: db.fn.now() });
  }
  return { accepted };
};
exports.start = ({ db, env = process.env, logger = console }) => {
  if (env.PUSH_ENABLED !== 'true') return () => {};
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    logger.warn('Browser push disabled: VAPID settings are missing.');
    return () => {};
  }
  const webPush = require('web-push');
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await exports.runBatch({
        db,
        send: (subscription, payload) =>
          webPush.sendNotification(subscription, payload, {
            TTL: 300,
            timeout: 10000,
            vapidDetails: {
              subject: env.VAPID_SUBJECT,
              publicKey: env.VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY,
            },
          }),
      });
    } catch (_) {
      logger.warn(
        'Browser push batch failed; check database and VAPID configuration.'
      );
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  return () => clearInterval(timer);
};
