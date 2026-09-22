'use strict';
// Module HTTP boundary. Shared authorization, workflow and data services are injected.
module.exports = ({
  audit,
  choice,
  crypto,
  date,
  db,
  digest,
  docAccess,
  fail,
  fileKey,
  hr,
  list,
  need,
  notify,
  number,
  ok,
  org,
  person,
  r,
  receive,
  text,
  uid,
  wrap,
}) => {
  r.get(
    '/documents',
    wrap(async (req, res) => {
      const q = db('doc_record')
        .where({ archived: false })
        .orderBy('id', 'desc');
      if (!hr(req))
        q.where(function () {
          this.where({ employee_id: uid(req) }).orWhere({
            visibility: 'company',
          });
        });
      ok(res, await list(req, q, ['title', 'category']));
    })
  );
  r.post(
    '/documents',
    receive,
    wrap(async (req, res) => {
      const b = req.body,
        f = req.file;
      if (!f) fail(400, 'Select a document to upload.');
      const bytes = f.buffer;
      const types = {
        'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-',
        'image/png': bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        'image/jpeg':
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[bytes.length - 2] === 255 &&
          bytes[bytes.length - 1] === 217,
      };
      if (!types[f.mimetype]) fail(400, 'Choose a valid PDF, PNG or JPEG.');
      const employee =
        hr(req) && b.employee_id ? number(b.employee_id, 'Employee') : uid(req);
      const visibility = hr(req)
        ? choice(
            b.visibility || 'private',
            ['private', 'company'],
            'visibility'
          )
        : 'private';
      await db.transaction(async (trx) => {
        await org(trx);
        await person(trx, employee);
        let id;
        if (b.document_id) {
          const d = await trx('doc_record')
            .where({ id: number(b.document_id, 'Document') })
            .forUpdate()
            .first();
          if (!d || d.archived) fail(404, 'Document not found.');
          if (!hr(req) && d.employee_id !== uid(req))
            fail(403, 'You cannot version this document.');
          id = d.id;
        } else
          [id] = await trx('doc_record').insert({
            employee_id: employee,
            title: text(b.title, 'Title'),
            category: text(b.category, 'Category', 60),
            visibility,
            expires_on: b.expires_on ? date(b.expires_on) : null,
            ack_required: hr(req) && b.ack_required === 'true',
          });
        const iv = crypto.randomBytes(12),
          cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv),
          encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
        const [file] = await trx('file_object').insert({
          owner_id: employee,
          filename:
            require('path')
              .basename(f.originalname)
              .replace(/[^a-zA-Z0-9._ -]/g, '_')
              .slice(0, 180) || 'document',
          mime: f.mimetype,
          size: bytes.length,
          encrypted_bytes: encrypted,
          iv: iv.toString('hex'),
          tag: cipher.getAuthTag().toString('hex'),
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        });
        const [last] = await trx('doc_version')
          .where({ document_id: id })
          .max('version_no as n');
        await trx('doc_version').insert({
          document_id: id,
          file_id: file,
          version_no: Number(last.n || 0) + 1,
          created_by: uid(req),
        });
        await audit(trx, req, 'documents', 'uploaded', id);
        await notify(trx, req, employee, 'A document is available');
      });
      ok(res, { saved: true });
    })
  );
  r.get(
    '/documents/:id/download',
    wrap(async (req, res) => {
      const d = await db('doc_record')
        .where({ id: number(req.params.id, 'Document') })
        .first();
      if (!d || !docAccess(req, d)) fail(404, 'Document not found.');
      const version = await db('doc_version')
          .where({ document_id: d.id })
          .orderBy('version_no', 'desc')
          .first(),
        f = await db('file_object').where({ id: version.file_id }).first();
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        fileKey,
        Buffer.from(f.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(f.tag, 'hex'));
      const bytes = Buffer.concat([
        decipher.update(f.encrypted_bytes),
        decipher.final(),
      ]);
      await audit(db, req, 'documents', 'downloaded', d.id);
      res
        .set({
          'Content-Type': f.mime,
          'Content-Disposition': 'attachment; filename="' + f.filename + '"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .send(bytes);
    })
  );
  r.post(
    '/documents/:id/acknowledge',
    wrap(async (req, res) => {
      await db.transaction(async (trx) => {
        const d = await trx('doc_record')
          .where({ id: number(req.params.id, 'Document') })
          .forUpdate()
          .first();
        if (!d || !docAccess(req, d)) fail(404, 'Document not found.');
        const v = await trx('doc_version')
          .where({ document_id: d.id })
          .orderBy('version_no', 'desc')
          .first();
        if (
          !(await trx('doc_acknowledgement')
            .where({ version_id: v.id, employee_id: uid(req) })
            .first())
        )
          await trx('doc_acknowledgement').insert({
            version_id: v.id,
            employee_id: uid(req),
          });
        await audit(trx, req, 'documents', 'acknowledged', d.id);
      });
      ok(res, { saved: true });
    })
  );
  r.post(
    '/documents/:id/archive',
    wrap(async (req, res) => {
      need(req);
      await db.transaction(async (trx) => {
        const id = number(req.params.id, 'Document');
        if (!(await trx('doc_record').where({ id }).first()))
          fail(404, 'Document not found.');
        await trx('doc_record').where({ id }).update({ archived: true });
        await audit(trx, req, 'documents', 'archived', id);
      });
      ok(res, { saved: true });
    })
  );
};
