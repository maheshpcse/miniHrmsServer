# Module workspace revision � 22 September 2026

## User-visible behavior

Organization rows are computed only on data/filter/expansion changes and tracked by employee ID. Search keeps matching ancestors; expand/collapse works even during a search. Department, role and location filters use one responsive row. Hidden administrator/self nodes are reconnected through the nearest visible ancestor.

Sidebar selection compares the path independently of tab/view query parameters. Expanded active modules expose section links. Approvals require a reporting team or HR capability; configuration and payroll actions retain server permission checks. Sidebar height leaves a footer gap.

Module roots open overview cards with permission-scoped counts and recent records. Section links open reports; Add new opens a separate entry view. Counts come from the existing authenticated endpoints, not the current page length. No placeholder charts or invented metrics. Query-only tab changes reuse module context. Filtering remounts neither the toolbar nor the shell: only results/pagination show loading. Existing resource reports already isolate their results loading.

Administrator accounts are excluded from organization/personnel selector data and scoped employee reports. The signed-in person is excluded from organization and employment-directory reports. Own onboarding tasks, leave, attendance, documents and payslips remain personal workflows; audit provenance and company notices are not erased just because an administrator created them.

## Architecture

Frontend: hr-core/modules/<module>/config.ts owns each module's sections, fields and permissions. core-models.ts defines the contracts. The registry composes them; shared page presentation supplies overview/entry/report views and shared validation, dropdown and feedback components. This retains Angular conventions rather than introducing an unrelated MVP framework.

Backend: core-router.js is a composition root. modules/<module>/routes.js owns its HTTP contracts; shared/platform.js supplies authorization, scoped access, workflow, auditing, transactions and pagination; shared/validation.js owns parsing. Organization has separate route, service and repository layers; communications has a delivery service and provider adapters. Other module command handlers still use Knex transactions in their module route files. This is a modular baseline, not a claim that every domain has a fully isolated persistence layer. Existing /api/portal/core URLs remain compatible.

## Email and SMS delivery

Profile settings store explicit email/SMS opt-in preferences. SMS requires an E.164 number including country code. Core workflow notifications enqueue delivery rows within the same database transaction. The worker rechecks active account and preferences before sending. It sends a generic sign-in reminder, never payroll amounts or personnel details.

Configure backend variables using config/notification-delivery.env.example. Existing SMTP credentials are reused. The prepared SMS adapter uses Twilio; provider selection can be replaced through providers.js. Set NOTIFICATION_DELIVERY_ENABLED=true only after configuring the intended service. Run node scripts/deliver-notifications.js from the backend project, or schedule this one-batch command in a separate Railway cron worker using the same database variables. Each invocation claims up to 20 queued records. The API process does not send synchronously or start a hidden delivery worker.

Delivery statuses: queued, processing, accepted (provider accepted; not handset/inbox delivery confirmation), failed, unknown and skipped. Ambiguous network/process failures become unknown and are never automatically resent. Provider callbacks and automated retries are not implemented. HR can inspect the delivery history under Notice board. SMS has no default live credentials, and delivery remains disabled locally. Password recovery continues to use its existing synchronous email flow. Legacy notification routes and future scheduled notices are not automatically migrated to this outbox.

Twilio request contract: https://www.twilio.com/docs/messaging/api/message-resource

## Database and verification

Forward migration 202609220002_notification_delivery adds the delivery outbox. Existing applied core migration is unchanged. Local target remains mini_hrms; production remains railway. Apply production via the existing migration/deployment process after reviewing changes; this work does not deploy or publish.

Backend regression and new queue/provider tests run with synthetic fixtures on guarded disposable MySQL, never production. They cover exclusion, capabilities, transaction queueing, provider request shape, accepted-send deduplication, ambiguous-send handling, opt-out and phone validation. No external email/SMS is sent in tests.

Production Angular compilation and headless browser checks cover all module overview/report/entry views, active sidebar state, tree identity and filtered expand/collapse, 390/768/1440px organization layout, preserved search focus and delivery preferences. The existing HammerJS optimization warning remains.
