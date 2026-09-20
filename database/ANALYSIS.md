# Source analysis and final schema

Analysis date: 2026-09-19. Target database: `mini_hrms`, MySQL 8.0.

## Evidence and precedence

| Source | Findings | Decision |
| --- | --- | --- |
| `MiNi HRMS_New.sql` | Earlier 12-table draft; `fisrtName`; no process-history table or personal bank JSON. Includes destructive drops. | Legacy upgrade input; do not run directly. |
| `mini_hrms (1).sql` | 13 tables, 13 procedures, one function; corrected `firstName`, process history and personal bank JSON. | Compare against the fuller dump and backend. |
| `mini_hrms.sql` | Same logical 13-table schema, explicit MySQL 8 collation/engine and export counters; one routine differs in password-expiry handling. | Most complete schema baseline; exclude data, dump counters, hard-coded definers and restore directives. This is a structural conclusion, not a claim based on filename dates. |
| `mini_hrms/employees.json` | One row with 13 keys matching `employees`; status represented as a string. | Confirms `firstName` and nested address/profile; not a new table. |
| `mini_hrms/employee_basic_info.json` | One row with 11 keys matching `employee_basic_details`. | Filename is an export alias; do not create an `_info` table. |
| `mini_hrms/employee_onboarding_info.json` | One row with 12 keys matching `employee_onboarding_details`; `employeeInfo.empId` and SQL-null approver. | Preserve JSON employee link and make absent approver truly nullable. |
| Postman collection | Five requests: one HRMS admin bootstrap endpoint and four unrelated external merchant/auth endpoints. | Validate bootstrap signature; exclude merchant, owner, equipment, and pricing entities. |
| Backend controllers/routes/configs | Knex 0.21 with MySQL; active routes use stored procedures and nested employee detail results; configured migration directory did not exist. | Add root CLI configuration and migrations; include all 14 supplied routines. |
| UI employee services/components | Use `empId` and existing API result objects. | Preserve API-facing field names and JSON layout. |

No instructions embedded in source documents were treated as user authorization. The supplied dumps and JSON contain sample/private records; only structural definitions are included in the migration.

## Final application tables

| Table | Role / relationship |
| --- | --- |
| `employees` | Employee identity; primary `userId`; unique `empId`, `userName`, `email`. |
| `employee_basic_details` | One basic-details document set per employee. |
| `employee_bank_details` | One bank-details row per employee, including `personalBanksInfo`. |
| `employee_onboarding_details` | Candidate/onboarding documents; nullable approver references `employees.empId`; employee identity remains in JSON. |
| `employee_process_details` | Multiple approval/rejection events per employee; approver/rejector references employees. |
| `employee_login` | One employee login per employee; login name references username. |
| `admin_login` | One admin login per employee, settings credential and password metadata. |
| `login_encrypt_details` | Login encryption configuration metadata. |
| `audit_employee_admin_login` | Multiple login/logout sessions per employee. |
| `attendance_types_details` | Attendance schedule/type configuration. |
| `employee_attendance_saved_details` | One biometric/online identifier mapping per employee. |
| `employee_attendance_details` | Multiple attendance sessions per employee. |
| `audit_employee_attendance` | Multiple away/return intervals per employee. |

There are 142 application columns. Knex additionally creates `knex_migrations` and `knex_migrations_lock` for migration bookkeeping.

## Reconciled differences

1. Rename the draft's `employees.fisrtName` to `firstName`, retaining the data. Refuse ambiguous databases that contain both columns.
2. Add missing `employee_bank_details.personalBanksInfo` as nullable JSON and create the later `employee_process_details` table when absent.
3. Change `employee_onboarding_details.approvedBy` to nullable `varchar(50) DEFAULT NULL`, matching the parent employee identifier. The string `'(NULL)'` is not SQL NULL. Existing invalid references are reported, not silently rewritten.
4. Remove unique single-column employee indexes from the attendance and away/return event tables. Keep non-unique lookup indexes and foreign keys so one employee can have repeated history. The saved attendance identity mapping remains one-to-one.
5. Add employee lookup indexes to process and login-audit history. Retain the dump's relationship model; do not invent constraints on audit history, `createdBy`, or the JSON onboarding identifier.
6. Retain the API's `benificiaryName` spelling, mixed-case JSON keys, status encodings, and string date/time columns. Renaming/converting these requires coordinated application changes and is outside this reconciliation.
7. Create parents before children, without disabling foreign-key checks or importing account/employee data.

## Routine baseline and compatibility

The routine baseline contains 13 procedures and `get_emp_name_by_created_by`. Hard-coded `root@localhost` definers are removed. Function output uses UTF-8 and declares `READS SQL DATA`; employee ID input widths match the 50-character key.

For newly installed routines, admin bootstrap no longer disables foreign keys or truncates employees when the admin table is empty; its two inserts are transactional. The baseline also corrects SQL NULL comparison and JSON unquoting in password expiry handling, integer-ID handling in the encryption-save procedure, and an invalid empty-string JSON comparison in employee detail retrieval. API signatures and result aliases remain intact.

Existing procedures/functions are preserved by migration, not overwritten based solely on these exports. Constants marked TODO in `spConfig.js` and other constants unused by active routes have no matching implementation in the supplied files; no speculative tables or procedures were invented for them.

## Validation results

Validated against an isolated MySQL 8.0.34 instance with synthetic records, not the configured application database:

- Fresh Knex migration: 13 tables, 13 procedures, one function.
- All supplied routine signatures executed; employee JSON response matches backend expectations.
- Multiple attendance/away records for the same employee accepted.
- Repeated migrations are no-ops; direct reruns of reconciliation also succeed.
- All three source DDL variants upgrade while retaining employee, basic-details and approved onboarding rows.
- Existing custom routine retained.
- Unknown columns and orphan FK values rejected by preflight.
- Automatic destructive rollback rejected.

Migration files are prepared and tested. They have not been applied to the user's configured `mini_hrms` database, and exported records have not been imported.
