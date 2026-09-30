# Workspace features � 30 September 2026

## Dashboards and navigation

Twelve module overview layouts now express their workflow: people lifecycle, attendance clock, leave balance wallet, document vault, workplace bulletin, event agenda, engagement, exit handover, payroll control room, approval desk, audit timeline and policy library. Counts and previews still come from authenticated role-scoped APIs. Actions & workflows exposes named entry actions and report links; the payroll control room opens /admin/payroll.

Sidebar links use 15px text, 25px icons, more spacing and a 264px expanded desktop width. Collapsed navigation preserves right-side tooltips. The fixed sidebar leaves bottom clearance. Blue/deep-blue/red accents are inspired by BMW M; no BMW logo or affiliation is introduced. Shared loading states use subtle skeleton gradients and respect reduced motion.

## Configured monthly payroll

Country/state-region/tax-year policy versions, compensation versions, locked attendance inputs, payroll drafts, a separate reviewer, immutable finalization, payslip publication and a finalized tax register are connected to the database. Financial arithmetic uses scaled integers and explicit currency decimal places. Snapshot checksums use sorted JSON keys so MySQL JSON normalization does not invalidate them. Existing finalized-result import remains available.

Workflow: create a jurisdiction policy with source/applicability notes; review and activate it; assign compensation effective on the first day of the desired month or earlier; lock completed attendance; confirm paid calendar days and year-to-date opening values; calculate a draft; a different payroll user marks it reviewed; finalize; publish the payslip. A second regular result for an employee/month is rejected. Cancel an open draft before recalculation. This does not transfer money to bank accounts.

Supported configurable primitives: annual allowance, progressive annual bands, a threshold rebate, tax-on-tax percentage, fixed monthly components, paid-day proration, and threshold/capped monthly levy rates for employee deductions, tax or employer contributions. Countries and regions are configuration metadata; US, UK and Asian country choices are available, but no legal rates are preseeded. Finance must supply and review applicable rules. Currency is explicit; there is no currency conversion.

**This is not a certified multi-country statutory payroll engine.** Automatic US W-4 withholding worksheets, cumulative UK tax-code PAYE, statutory filings, tax-code changes, local rate feeds, treaty/residency cases, automatic benefits valuation, off-cycle adjustments and complex statutory rounding are not implemented. Year-to-date gross/income-tax values are reviewed inputs, not inferred from incomplete historical data. Use the finalized-result import path for an external statutory engine where these are required. The UI states the scope before policy activation/calculation.

Official references used to establish these boundaries:
- https://www.irs.gov/publications/p15t
- https://www.gov.uk/running-payroll
- https://www.incometax.gov.in/iec/foportal/node/11678

## Employee chat and HR guide

Footer HR help & chat opens an accessible panel. /admin/chat provides a larger conversation workspace. HR help searches authored workflow guidance and links to the relevant page; it is not connected to an AI provider, as requested.

Direct conversations and groups (2�50 members), persisted text messages, unread state, read acknowledgements, bounded message history, older-message loading and idempotent sends are implemented. Every read/write checks membership on the backend. Room listing batches unread/peer queries, supports paging, and returns at most 100 rooms per request. Messages return at most 50 per request; sending is limited to 30 per minute per account. Rendering escapes text. Polling runs every five seconds only while the browser document is visible; timers are removed when the component closes. This is polling-backed chat, not a WebSocket service. Attachments, calling, presence and group-membership administration are not included.

## Browser push

Push is now a separate delivery mechanism from the navbar's unread poll. Settings contains an explicit browser opt-in. A notification-only service worker handles background push and notification clicks under the app base path, including /miniHrmsUI/ on GitHub Pages. It does not cache HR data. Payloads contain only a generic sign-in reminder. Account logout disables the local subscription and attempts server revocation.

Backend config/browser-push.env.example lists PUSH_ENABLED and VAPID settings. Install dependencies normally; generate stable keys with npx web-push generate-vapid-keys; store the private key only in backend environment secrets. Set a real mailto or HTTPS VAPID_SUBJECT. With PUSH_ENABLED=true and all keys present, the API starts a five-second queue worker. HTTPS is required except on localhost. The application must be restarted after environment changes. No VAPID keys are generated or enabled by these changes.

Subscriptions accept supported browser-provider HTTPS endpoints only, preventing arbitrary server requests. Personal and broadcast notification visibility is rechecked, inactive subscriptions are skipped, read notifications are suppressed, old-account queued deliveries are not transferred, and expired endpoints are disabled. Atomic compare-and-set job claims prevent duplicate workers from sending the same queued item. This also fixes a concurrency deadlock in the older email/SMS queue. Ambiguous delivery results are retained as unknown and not automatically resent. Provider acceptance is not proof a device displayed the notification.

References: https://developer.mozilla.org/en-US/docs/Web/API/Push_API and https://www.npmjs.com/package/web-push
Palette reference: https://www.bmw-m.com/en/topics/magazine-article-pool/die-geschichte-des-bmw-m-logos.html

## Database and tests

Forward migration 202609300001_workspace_communication_payroll creates chat, push and payroll-configuration/run tables. Existing applied migrations are unchanged. Local database remains mini_hrms; production remains railway. No production deployment, Git commit/push, external messages or image previews are performed.

Backend integration tests cover chat access/unread/replay, tax arithmetic and currency rounding, payroll authorization/review/finalization/publication, canonical snapshots, push endpoint validation/queue/deduplication/opt-out, and previous HR regressions using guarded disposable MySQL. Browser tests cover twelve distinct layouts at 390/768/1440px, workflow actions, sidebar selection, configuration forms, disabled-unconfigured push settings, service-worker artifact, footer help and a persisted chat message. No live browser push, email or SMS delivery has been verified without production provider configuration.
