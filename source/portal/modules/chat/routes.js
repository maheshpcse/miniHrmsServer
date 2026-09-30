'use strict';
module.exports = (p) => {
  const { r, wrap, ok, db, uid, text, number, fail, notify } = p;
  const member = async (req, id, trx = db) => {
    const m = await trx('chat_member')
      .where({ room_id: id, employee_id: uid(req) })
      .first();
    if (!m) fail(404, 'Conversation not found.');
    return m;
  };
  r.get(
    '/chat/people',
    wrap(async (req, res) => {
      const q = db('employees')
        .where({ status: 1 })
        .whereNot('userId', uid(req))
        .whereNot('roleName', 'admin');
      if (req.query.q) {
        const term = text(req.query.q, 'Search', 80);
        q.where(function () {
          this.where('firstName', 'like', '%' + term + '%')
            .orWhere('lastName', 'like', '%' + term + '%')
            .orWhere('empId', 'like', '%' + term + '%');
        });
      }
      ok(
        res,
        await q
          .select('userId as id', 'firstName', 'lastName', 'empId')
          .orderBy('firstName')
          .limit(50)
      );
    })
  );
  r.get(
    '/chat/rooms',
    wrap(async (req, res) => {
      const page = number(req.query.page || 1, 'Page', 1, 10000);
      const rooms = await db('chat_room as r')
        .join('chat_member as m', 'm.room_id', 'r.id')
        .where('m.employee_id', uid(req))
        .select(
          'r.id',
          'r.title',
          'r.kind',
          'r.updated_at',
          'r.last_message_id',
          'm.last_read_id'
        )
        .orderBy('r.updated_at', 'desc')
        .orderBy('r.id', 'desc')
        .limit(100)
        .offset((page - 1) * 100);
      if (rooms.length) {
        const counts = await db('chat_member as m')
          .leftJoin('chat_message as x', function () {
            this.on('x.room_id', '=', 'm.room_id')
              .andOn('x.id', '>', 'm.last_read_id')
              .andOn('x.sender_id', '<>', db.raw('?', [uid(req)]));
          })
          .where('m.employee_id', uid(req))
          .whereIn(
            'm.room_id',
            rooms.map((r) => r.id)
          )
          .groupBy('m.room_id')
          .select('m.room_id')
          .count('x.id as count');
        const directIds = rooms
          .filter((r) => r.kind === 'direct')
          .map((r) => r.id);
        const peers = directIds.length
          ? await db('chat_member as m')
              .join('employees as e', 'e.userId', 'm.employee_id')
              .whereIn('m.room_id', directIds)
              .whereNot('m.employee_id', uid(req))
              .select('m.room_id', 'e.firstName', 'e.lastName')
          : [];
        for (const room of rooms) {
          const count = counts.find((c) => c.room_id === room.id);
          room.unread = Number((count && count.count) || 0);
          if (room.kind === 'direct') {
            const peer = peers.find((p) => p.room_id === room.id);
            room.title = peer
              ? [peer.firstName, peer.lastName].filter(Boolean).join(' ')
              : 'Conversation';
          }
        }
      }
      ok(res, rooms);
    })
  );
  r.post(
    '/chat/rooms',
    wrap(async (req, res) => {
      if (!Array.isArray(req.body.members))
        fail(400, 'Choose conversation members.');
      const ids = [
        ...new Set([
          uid(req),
          ...req.body.members.map((v) => number(v, 'Member')),
        ]),
      ];
      if (ids.length < 2 || ids.length > 50)
        fail(400, 'Choose between 2 and 50 conversation members.');
      const direct = ids.length === 2 && !req.body.group,
        key = direct
          ? ids
              .slice()
              .sort((a, b) => a - b)
              .join(':')
          : null;
      const valid = await db('employees')
        .whereIn('userId', ids)
        .where({ status: 1 })
        .select('userId');
      if (valid.length !== ids.length)
        fail(400, 'Choose active workspace members.');
      if (key) {
        const existing = await db('chat_room')
          .where({ direct_key: key })
          .first();
        if (existing) return ok(res, { id: existing.id });
      }
      let id;
      try {
        id = await db.transaction(async (trx) => {
          const [room] = await trx('chat_room').insert({
            title: direct
              ? 'Direct conversation'
              : text(req.body.title, 'Group name', 120),
            kind: direct ? 'direct' : 'group',
            direct_key: key,
            created_by: uid(req),
          });
          await trx('chat_member').insert(
            ids.map((employee_id) => ({ room_id: room, employee_id }))
          );
          return room;
        });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY' && key) {
          const old = await db('chat_room').where({ direct_key: key }).first();
          if (old) return ok(res, { id: old.id });
        }
        throw e;
      }
      ok(res, { id });
    })
  );
  r.get(
    '/chat/rooms/:id/messages',
    wrap(async (req, res) => {
      const id = number(req.params.id, 'Conversation');
      await member(req, id);
      const q = db('chat_message as m')
        .join('employees as e', 'e.userId', 'm.sender_id')
        .where('m.room_id', id);
      if (req.query.after)
        q.where('m.id', '>', number(req.query.after, 'Cursor', 0));
      if (req.query.before)
        q.where('m.id', '<', number(req.query.before, 'Cursor'));
      const ascending = !!req.query.after;
      const rows = await q
        .select(
          'm.id',
          'm.body',
          'm.sender_id',
          'm.created_at',
          'e.firstName',
          'e.lastName'
        )
        .orderBy('m.id', ascending ? 'asc' : 'desc')
        .limit(50);
      ok(res, {
        list: ascending ? rows : rows.reverse(),
        hasMore: rows.length === 50,
      });
    })
  );
  r.post(
    '/chat/rooms/:id/messages',
    wrap(async (req, res) => {
      const roomId = number(req.params.id, 'Conversation'),
        body = text(req.body.body, 'Message', 4000),
        nonce = text(req.body.client_nonce, 'Message reference', 80);
      const result = await db.transaction(async (trx) => {
        await member(req, roomId, trx);
        const room = await trx('chat_room')
          .where({ id: roomId })
          .forUpdate()
          .first();
        const old = await trx('chat_message')
          .where({ room_id: roomId, sender_id: uid(req), client_nonce: nonce })
          .first();
        if (old) {
          if (old.body !== body) fail(409, 'Message reference already used.');
          return { id: old.id };
        }
        const [recent] = await trx('chat_message')
          .where({ sender_id: uid(req) })
          .where('created_at', '>', new Date(Date.now() - 60000))
          .count('* as count');
        if (Number(recent.count) >= 30)
          fail(429, 'Please wait a moment before sending more messages.');
        const [id] = await trx('chat_message').insert({
          room_id: roomId,
          sender_id: uid(req),
          client_nonce: nonce,
          body,
        });
        await trx('chat_room')
          .where({ id: roomId })
          .update({ last_message_id: id, updated_at: trx.fn.now() });
        await trx('chat_member')
          .where({ room_id: roomId, employee_id: uid(req) })
          .update({ last_read_id: id });
        const peers = await trx('chat_member')
          .where({ room_id: roomId })
          .whereNot('employee_id', uid(req));
        for (const peer of peers)
          if (Number(peer.last_read_id) >= Number(room.last_message_id))
            await notify(
              trx,
              req,
              peer.employee_id,
              'You have a new workspace message'
            );
        return { id };
      });
      ok(res, result);
    })
  );
  r.post(
    '/chat/rooms/:id/read',
    wrap(async (req, res) => {
      const room = number(req.params.id, 'Conversation'),
        id = number(req.body.message_id, 'Message');
      await member(req, room);
      if (!(await db('chat_message').where({ room_id: room, id }).first()))
        fail(400, 'Message does not belong to this conversation.');
      await db('chat_member')
        .where({ room_id: room, employee_id: uid(req) })
        .where('last_read_id', '<', id)
        .update({ last_read_id: id });
      ok(res, { saved: true });
    })
  );
};
