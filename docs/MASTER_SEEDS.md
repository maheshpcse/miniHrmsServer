# Master seeds and local demo accounts

Source: hrms_master_seed_architecture.md supplied on 30 September 2026. The attachment describes an architecture and names SQL packs, but does not contain their SQL bodies. These eight ordered JSON packs and a Knex runner implement a compatible seed layer for this existing MySQL application; they do not replace applied migrations or create a second payroll engine.

## Seed migration

Run the normal `npm run db:migrate`. Migration `202609300002_master_seed_catalog.js` creates `hrms_master_category` and `hrms_master_value`, then loads `database/seeds/001_...json` through `008_...json` in order. Local target remains `mini_hrms`; production target remains `railway`.

Lookups use category + scope + business code, never assumed numeric IDs. System values use scope SYSTEM with no organization ID. Organization overrides can use ORG:<actual ID> and an explicit organization FK. Unique indexes and foreign keys preserve identity. The row model includes state, effective dates, version, actor references and timestamps. No numeric organization 1 is hard-coded. Existing codes, role grants, custom names and disabled values are preserved on rerun. Future changes to an existing policy require a reviewed new version/forward migration; deleting referenced values is not part of the runner.

`GET /api/portal/core/masters?category=LEAVE_TYPE` exposes the system seed catalog to authenticated HR/admin users; employees receive 403. Roles and executable permissions are seeded into the existing portal_catalog used by authentication. Menu metadata records existing routes without adding duplicate shortcut links. API authorization remains authoritative.

## Active data versus templates

207 starter values include employment/relationship/status codes, organization templates, attendance/leave templates, documents, notices, engagement/events, exit/clearance, approval levels, notification definitions, country/timezone/currency starters and payroll component/rounding definitions. This is a starter catalog, not a complete global country/subdivision database. State/region values are supplied when configuring the applicable organization or tax policy; no incomplete list is presented as worldwide coverage.

Organization, shift, overtime, leave and jurisdiction templates do not activate policy enforcement automatically. No universal leave allowance, public holiday schedule or statutory tax rate is inserted. Notification definitions do not create new schedulers; existing implemented event producers remain responsible for delivery. Email/SMS remain opt-in and require provider configuration; no external messages are sent by seeding.

The 11 role definitions retain the requested stable codes. SUPER_ADMIN maps to existing admin; HR_MANAGER to hr; HR_ADMIN to the supported hr_admin role; PAYROLL_ADMIN to fm; MANAGER to rm; EMPLOYEE to employee. Attendance/leave/document/engagement specialists and AUDITOR remain unassignable templates because current handlers do not enforce those narrower permission domains. They are not given broad hr:manage access as a substitute. This pack does not claim a complete new RBAC engine, tenant isolation redesign, document object-storage migration or automatic encryption rollout.

## Local demo accounts

`npm run db:seed:demo` is a separate explicit operation, never called by migrations or deployment. It rejects production, remote database hosts and non-mini_hrms targets. Required environment variables:

- DEMO_SEED_ENABLED=true
- DEMO_ORGANIZATION_ID=<existing organization ID chosen explicitly>
- DEMO_PASSWORD=<private 14-72 UTF-8 byte password>

Accounts: demo.hr (HR), demo.manager (reporting manager), demo.employee and demo.employee2 (employees). Use the normal application login page and the supplied private password. No bypass/demo token endpoint is added. Passwords are salted with bcrypt; generated credentials must stay outside Git and browser assets. Emails use example.invalid and external preferences are disabled.

The script adds synthetic job assignments, employee-to-manager links, onboarding tasks and audit entries. It preserves existing demo passwords and profile changes on rerun and rejects collisions with non-demo accounts. It does not create a payroll bank transfer, reset existing users or manufacture live salary data. To reset passwords later use the normal authenticated profile flow. Demo data stays local and is not a production seed.

## Verification

`tests/master-seeds.integration.js`, called by the guarded disposable-MySQL portal suite, checks migration/reseed idempotence, customization preservation, template status, production guard, all demo logins, HR/self/team access, persisted punch replay and HR chat. Browser checks cover fixed popup size, single scrolling content, full-chat launcher suppression, aligned searches/tabs, and stable native checkbox geometry with keyboard focus.
