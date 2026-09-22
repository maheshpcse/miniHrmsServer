'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');
exports.config = { transaction: false };
exports.up = async (db) => {
  await assertDatabaseTarget(db);
  const create = async (name, fn) => {
    if (!(await db.schema.hasTable(name)))
      await db.schema.createTable(name, (t) => {
        t.bigIncrements('id');
        fn(t);
      });
  };
  const employee = (t, key = 'employee_id') =>
    t
      .integer(key)
      .notNullable()
      .references('userId')
      .inTable('employees')
      .index();
  const ref = (t, key, table, nullable = false) => {
    const c = t.bigInteger(key).unsigned();
    if (!nullable) c.notNullable();
    c.references('id').inTable(table).index();
  };
  const stamp = (t) => {
    t.dateTime('created_at', 6)
      .notNullable()
      .defaultTo(db.raw('CURRENT_TIMESTAMP(6)'));
  };
  await create('org_entity', (t) => {
    t.string('name', 150).notNullable();
    t.string('timezone', 64).notNullable().defaultTo('Asia/Kolkata');
    stamp(t);
  });
  if (!(await db('org_entity').first()))
    await db('org_entity').insert({ name: 'MiNi HRMS' });
  await create('org_unit', (t) => {
    ref(t, 'organization_id', 'org_entity');
    t.string('kind', 30).notNullable();
    t.string('name', 150).notNullable();
    t.unique(['organization_id', 'kind', 'name']);
  });
  await create('emp_job_assignment', (t) => {
    employee(t);
    ref(t, 'organization_id', 'org_entity');
    t.integer('manager_id')
      .nullable()
      .references('userId')
      .inTable('employees')
      .index();
    t.string('department', 100).notNullable();
    t.string('designation', 100).notNullable();
    t.string('location', 100);
    t.string('employment_type', 40).notNullable();
    t.date('effective_from').notNullable();
    t.date('effective_to');
    employee(t, 'created_by');
    stamp(t);
    t.index(['employee_id', 'effective_from', 'effective_to']);
  });
  await create('hr_policy', (t) => {
    ref(t, 'organization_id', 'org_entity');
    t.string('module', 32).notNullable();
    t.string('name', 150).notNullable();
    t.json('rules').notNullable();
    t.date('effective_from').notNullable();
    employee(t, 'created_by');
    stamp(t);
  });
  await create('emp_onboarding_task', (t) => {
    employee(t);
    t.string('area', 32).notNullable();
    t.string('title', 200).notNullable();
    t.string('status', 20).defaultTo('pending');
    t.date('due_date');
    employee(t, 'created_by');
    stamp(t);
  });
  await create('emp_detail_record', (t) => {
    employee(t);
    t.string('kind', 32).notNullable();
    t.string('title', 150).notNullable();
    t.text('detail');
    t.date('effective_from');
    employee(t, 'created_by');
    stamp(t);
  });
  await create('wf_instance', (t) => {
    employee(t);
    t.string('module', 32).notNullable();
    t.bigInteger('entity_id').unsigned().notNullable();
    t.string('status', 20).notNullable().defaultTo('pending');
    t.integer('reviewer_id')
      .nullable()
      .references('userId')
      .inTable('employees');
    stamp(t);
    t.unique(['module', 'entity_id']);
  });
  await create('wf_action', (t) => {
    ref(t, 'workflow_id', 'wf_instance');
    employee(t, 'actor_id');
    t.string('action', 20).notNullable();
    t.text('comment');
    stamp(t);
  });
  await create('audit_log', (t) => {
    employee(t, 'actor_id');
    t.string('module', 32).notNullable();
    t.string('action', 40).notNullable();
    t.bigInteger('entity_id').unsigned();
    t.json('metadata');
    stamp(t);
    t.index(['module', 'created_at']);
  });
  await create('lv_holiday', (t) => {
    ref(t, 'organization_id', 'org_entity');
    t.date('holiday_date').notNullable();
    t.string('name', 150).notNullable();
    t.unique(['organization_id', 'holiday_date']);
  });
  await create('att_punch_event', (t) => {
    employee(t);
    t.string('event_type', 16).notNullable();
    t.dateTime('event_at_utc', 6).notNullable();
    t.date('attendance_date').notNullable();
    t.string('timezone', 64).notNullable();
    t.string('source', 16).defaultTo('WEB');
    t.string('correlation_id', 64).notNullable();
    stamp(t);
    t.unique(['employee_id', 'correlation_id']);
    t.index(['employee_id', 'event_at_utc']);
  });
  await create('att_daily_summary', (t) => {
    employee(t);
    t.date('attendance_date').notNullable();
    t.integer('worked_minutes').notNullable().defaultTo(0);
    t.integer('break_minutes').notNullable().defaultTo(0);
    t.string('status', 24).notNullable();
    t.integer('version_no').defaultTo(1);
    stamp(t);
    t.unique(['employee_id', 'attendance_date']);
  });
  await create('att_regularization_request', (t) => {
    employee(t);
    t.date('attendance_date').notNullable();
    t.integer('minutes').notNullable();
    t.text('reason').notNullable();
    t.string('status', 20).defaultTo('pending');
    stamp(t);
  });
  await create('att_overtime_request', (t) => {
    employee(t);
    t.date('attendance_date').notNullable();
    t.integer('minutes').notNullable();
    t.text('reason').notNullable();
    t.string('status', 20).defaultTo('pending');
    stamp(t);
  });
  await create('att_period_lock', (t) => {
    t.string('period', 7).notNullable().unique();
    employee(t, 'locked_by');
    stamp(t);
  });
  await create('att_payroll_summary', (t) => {
    employee(t);
    ref(t, 'lock_id', 'att_period_lock');
    t.integer('worked_minutes').notNullable();
    t.integer('overtime_minutes').notNullable();
    t.decimal('paid_leave_days', 8, 2).notNullable();
    t.decimal('unpaid_leave_days', 8, 2).notNullable();
    t.string('source_checksum', 64).notNullable();
    stamp(t);
    t.unique(['employee_id', 'lock_id']);
  });
  await create('lv_leave_type', (t) => {
    t.string('name', 100).notNullable().unique();
    t.boolean('paid').notNullable();
    t.boolean('allow_negative').notNullable().defaultTo(false);
  });
  await create('lv_balance', (t) => {
    employee(t);
    ref(t, 'leave_type_id', 'lv_leave_type');
    t.integer('leave_year').notNullable();
    t.decimal('available', 8, 2).notNullable().defaultTo(0);
    t.decimal('reserved', 8, 2).notNullable().defaultTo(0);
    t.unique(['employee_id', 'leave_type_id', 'leave_year']);
  });
  await create('lv_request', (t) => {
    employee(t);
    ref(t, 'leave_type_id', 'lv_leave_type');
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.decimal('requested_units', 8, 2).notNullable();
    t.text('reason').notNullable();
    t.string('status', 20).defaultTo('pending');
    stamp(t);
  });
  await create('lv_request_day', (t) => {
    ref(t, 'request_id', 'lv_request');
    t.date('leave_date').notNullable();
    t.decimal('units', 4, 2).notNullable();
    t.unique(['request_id', 'leave_date']);
  });
  await create('lv_accrual_ledger', (t) => {
    employee(t);
    ref(t, 'leave_type_id', 'lv_leave_type');
    t.integer('leave_year').notNullable();
    t.string('transaction_type', 24).notNullable();
    t.decimal('quantity', 8, 2).notNullable();
    ref(t, 'request_id', 'lv_request', true);
    t.string('reference', 200);
    employee(t, 'created_by');
    stamp(t);
  });
  await create('file_object', (t) => {
    employee(t, 'owner_id');
    t.string('filename', 180).notNullable();
    t.string('mime', 80).notNullable();
    t.integer('size').notNullable();
    t.specificType('encrypted_bytes', 'LONGBLOB').notNullable();
    t.string('iv', 32).notNullable();
    t.string('tag', 32).notNullable();
    t.string('sha256', 64).notNullable();
    stamp(t);
  });
  await create('doc_record', (t) => {
    employee(t);
    t.string('title', 180).notNullable();
    t.string('category', 60).notNullable();
    t.string('visibility', 20).notNullable().defaultTo('private');
    t.date('expires_on');
    t.boolean('ack_required').defaultTo(false);
    t.boolean('archived').defaultTo(false);
    stamp(t);
  });
  await create('doc_version', (t) => {
    ref(t, 'document_id', 'doc_record');
    ref(t, 'file_id', 'file_object');
    t.integer('version_no').notNullable();
    employee(t, 'created_by');
    stamp(t);
    t.unique(['document_id', 'version_no']);
  });
  await create('doc_acknowledgement', (t) => {
    ref(t, 'version_id', 'doc_version');
    employee(t);
    stamp(t);
    t.unique(['version_id', 'employee_id']);
  });
  await create('notice', (t) => {
    t.string('title', 180).notNullable();
    t.text('body').notNullable();
    t.string('audience', 20).notNullable();
    t.integer('recipient_id')
      .nullable()
      .references('userId')
      .inTable('employees');
    t.dateTime('publish_at', 6).notNullable();
    t.dateTime('expires_at', 6);
    t.boolean('ack_required').defaultTo(false);
    employee(t, 'created_by');
    stamp(t);
  });
  await create('notice_recipient', (t) => {
    ref(t, 'notice_id', 'notice');
    employee(t);
    t.dateTime('read_at', 6);
    t.dateTime('acknowledged_at', 6);
    t.unique(['notice_id', 'employee_id']);
  });
  await create('evt_event', (t) => {
    t.string('title', 180).notNullable();
    t.text('description');
    t.dateTime('starts_at', 6).notNullable();
    t.dateTime('ends_at', 6).notNullable();
    t.string('timezone', 64).notNullable();
    t.string('venue', 180);
    t.integer('capacity').notNullable();
    t.string('status', 20).defaultTo('published');
    employee(t, 'created_by');
    stamp(t);
  });
  await create('evt_rsvp', (t) => {
    ref(t, 'event_id', 'evt_event');
    employee(t);
    t.string('response', 20).notNullable();
    stamp(t);
    t.unique(['event_id', 'employee_id']);
  });
  await create('evt_task', (t) => {
    ref(t, 'event_id', 'evt_event');
    t.string('title', 180).notNullable();
    employee(t, 'owner_id');
    t.string('status', 20).defaultTo('pending');
    stamp(t);
  });
  await create('eng_survey', (t) => {
    t.string('title', 180).notNullable();
    t.text('question').notNullable();
    t.json('options').notNullable();
    t.boolean('anonymous').notNullable();
    t.integer('privacy_threshold').notNullable().defaultTo(5);
    t.dateTime('closes_at', 6).notNullable();
    employee(t, 'created_by');
    stamp(t);
  });
  await create('eng_response', (t) => {
    ref(t, 'survey_id', 'eng_survey');
    t.string('participant_hash', 64).notNullable();
    t.integer('employee_id')
      .nullable()
      .references('userId')
      .inTable('employees');
    t.integer('answer').notNullable();
    stamp(t);
    t.unique(['survey_id', 'participant_hash']);
  });
  await create('eng_recognition', (t) => {
    employee(t);
    employee(t, 'created_by');
    t.string('category', 50).notNullable();
    t.text('message').notNullable();
    stamp(t);
  });
  await create('eng_feedback', (t) => {
    employee(t);
    t.string('kind', 24).notNullable();
    t.string('title', 180).notNullable();
    t.text('description').notNullable();
    t.string('status', 20).defaultTo('submitted');
    stamp(t);
  });
  await create('exit_case', (t) => {
    employee(t);
    t.date('resignation_date').notNullable();
    t.date('requested_lwd').notNullable();
    t.date('approved_lwd');
    t.text('reason').notNullable();
    t.string('status', 24).defaultTo('pending');
    stamp(t);
  });
  await create('exit_clearance_item', (t) => {
    ref(t, 'exit_case_id', 'exit_case');
    t.string('title', 180).notNullable();
    t.string('status', 20).defaultTo('pending');
    t.text('remarks');
    t.integer('completed_by')
      .nullable()
      .references('userId')
      .inTable('employees');
    t.dateTime('completed_at', 6);
  });
  await create('payroll_result', (t) => {
    employee(t);
    t.string('external_reference', 100).notNullable().unique();
    t.string('period', 7).notNullable();
    t.string('currency', 3).notNullable();
    t.decimal('gross', 19, 4).notNullable();
    t.decimal('deductions', 19, 4).notNullable();
    t.decimal('net', 19, 4).notNullable();
    t.decimal('tax', 19, 4).notNullable();
    t.decimal('reimbursements', 19, 4).notNullable();
    t.decimal('employer_contributions', 19, 4).notNullable();
    t.json('components').notNullable();
    t.json('input_snapshot').notNullable();
    t.string('source_system', 100).notNullable();
    t.string('checksum', 64).notNullable();
    employee(t, 'imported_by');
    stamp(t);
  });
  await create('payroll_result_component', (t) => {
    ref(t, 'result_id', 'payroll_result');
    t.string('code', 50).notNullable();
    t.string('name', 150).notNullable();
    t.string('type', 30).notNullable();
    t.decimal('amount', 19, 4).notNullable();
    t.string('explanation', 500);
    t.unique(['result_id', 'code']);
  });
  await create('payroll_result_tax', (t) => {
    ref(t, 'result_id', 'payroll_result');
    t.string('code', 50).notNullable();
    t.decimal('amount', 19, 4).notNullable();
    t.unique(['result_id', 'code']);
  });
  await create('payroll_payslip', (t) => {
    ref(t, 'result_id', 'payroll_result');
    t.unique(['result_id']);
    employee(t, 'published_by');
    stamp(t);
  });
  await create('salary_query', (t) => {
    employee(t);
    ref(t, 'result_id', 'payroll_result');
    t.string('subject', 180).notNullable();
    t.text('description').notNullable();
    t.string('status', 20).defaultTo('open');
    t.text('reply');
    stamp(t);
  });
  for (const p of ['hr:manage', 'payroll:manage'])
    if (
      !(await db('portal_catalog')
        .where({ kind: 'permissions', code: p })
        .first())
    )
      await db('portal_catalog').insert({
        kind: 'permissions',
        code: p,
        name: p,
        description:
          p === 'hr:manage'
            ? 'Manage HR modules and organization'
            : 'Import and publish finalized payroll',
        payload: '{}',
        status: 1,
      });
  // Grant only the established HR and finance roles their domain permissions.
  for (const [role, code] of [
    ['hr', 'hr:manage'],
    ['fm', 'payroll:manage'],
  ]) {
    const r = await db('portal_catalog')
      .where({ kind: 'roles', code: role })
      .first();
    if (r) {
      const payload =
        typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload || {};
      payload.permissions = Array.from(
        new Set(
          String(payload.permissions || '')
            .split(',')
            .filter(Boolean)
            .concat(code)
        )
      ).join(',');
      await db('portal_catalog')
        .where({ id: r.id })
        .update({ payload: JSON.stringify(payload) });
    }
  }
};
exports.down = async () => {
  throw new Error(
    'HR core records are forward-only; use a reviewed restore or forward migration.'
  );
};
