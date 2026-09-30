'use strict';
module.exports = (p) => {
  const { r, wrap, ok, db, uid, fail, crypto } = p;
  const configured = () =>
    process.env.PUSH_ENABLED === 'true' &&
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY &&
    !!process.env.VAPID_SUBJECT;
  const validate = (b) => {
    let url;
    try {
      url = new URL(b.endpoint);
    } catch {
      fail(400, 'Invalid browser push endpoint.');
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !(
        [
          'fcm.googleapis.com',
          'updates.push.services.mozilla.com',
          'web.push.apple.com',
        ].includes(host) ||
        host.endsWith('.notify.windows.com') ||
        host.endsWith('.push.apple.com')
      )
    )
      fail(400, 'This push provider is not supported.');
    if (
      b.endpoint.length > 3000 ||
      !b.keys ||
      !/^[A-Za-z0-9_-]+$/.test(b.keys.p256dh || '') ||
      !/^[A-Za-z0-9_-]+$/.test(b.keys.auth || '') ||
      Buffer.from(b.keys.p256dh, 'base64url').length !== 65 ||
      Buffer.from(b.keys.auth, 'base64url').length !== 16
    )
      fail(400, 'Invalid browser subscription keys.');
    return b;
  };
  r.get(
    '/push/config',
    wrap(async (req, res) =>
      ok(res, {
        enabled: configured(),
        publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null,
      })
    )
  );
  r.post(
    '/push/subscribe',
    wrap(async (req, res) => {
      if (!configured())
        fail(503, 'Browser push is not configured by your administrator yet.');
      const b = validate(req.body),
        hash = crypto.createHash('sha256').update(b.endpoint).digest('hex');
      await db.transaction(async (trx) => {
        const old = await trx('push_subscription')
          .where({ endpoint_hash: hash })
          .forUpdate()
          .first();
        if (old && (old.p256dh !== b.keys.p256dh || old.auth !== b.keys.auth))
          fail(409, 'Re-create this browser subscription before continuing.');
        const [latest] = await trx('portal_notifications').max('id as id');
        const data = {
          employee_id: uid(req),
          endpoint_hash: hash,
          endpoint: b.endpoint,
          p256dh: b.keys.p256dh,
          auth: b.keys.auth,
          active: true,
          last_notification_id: Number(latest.id) || 0,
        };
        if (old)
          await trx('push_subscription').where({ id: old.id }).update(data);
        else await trx('push_subscription').insert(data);
      });
      ok(res, { subscribed: true });
    })
  );
  r.post(
    '/push/unsubscribe',
    wrap(async (req, res) => {
      const endpoint = req.body.endpoint;
      if (typeof endpoint !== 'string')
        fail(400, 'Provide this browser subscription.');
      const hash = crypto.createHash('sha256').update(endpoint).digest('hex');
      await db('push_subscription')
        .where({ endpoint_hash: hash, employee_id: uid(req) })
        .update({ active: false });
      ok(res, { subscribed: false });
    })
  );
};
