# mini_hrms database migrations

The backend now has a Knex migration entry point. Use MySQL 8.0 and the backend's existing `knex` and `mysql` dependencies. No additional npm packages are needed.

## Apply

From `miniHrmsServer`, set the existing `.env` connection variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`) and `DB_NAME=mini_hrms`. The migration CLI reads this file without loading the API server or its startup jobs. Local development uses `mini_hrms`. In production set `NODE_ENV=production` and `DB_NAME=railway`; the same migrations target `railway`. Migrations verify the active connection matches the environment before changing tables.

For a new installation, first create the database using a MySQL client:

```sql
SOURCE E:/MEAN/Apps/MiNi HRMS/miniHrmsServer/database/bootstrap.sql;
```

For both a new database and an existing installation:

```powershell
npm.cmd run db:migrate:status
npm.cmd run db:migrate
npm.cmd run db:migrate:status
```

The database account needs schema/index/foreign-key permissions, SELECT on existing tables, routine creation privileges, and access to the Knex migration tracking tables. For binary-logged MySQL installations, creating the supplied data-reading function may require DBA provisioning under the server's stored-function policy.

The existing `mysql` driver requires an authentication method it supports; this migration does not alter server authentication or user accounts.

## Files

- `../db_migrations/202609190001_reconcile_mini_hrms_tables.js`: creates missing tables and reconciles the three supplied schema variants, preserving rows.
- `../db_migrations/202609190002_install_missing_mini_hrms_routines.js`: installs the missing function and procedures required by the API. Existing routines are retained, including custom versions.
- `schema/tables.json` and `schema/routines.json`: reviewed definitions loaded by the versioned migrations. Treat these baseline assets as immutable after deployment; use new migrations for future changes.
- `schema/mini_hrms.sql` and `schema/mini_hrms.routines.sql`: readable final SQL for an empty database. These SQL exports explicitly target local `mini_hrms`; use the Knex migrations for production `railway`. They are alternatives for manual installation, not upgrade scripts. The routine file requires a client supporting `DELIMITER`.
- `ANALYSIS.md`: source comparison, selected schema, corrections, and limits.
- `DATA_DICTIONARY.md`: all 142 columns plus primary, unique, secondary, and foreign keys.

No sample employees, bank data, password hashes, encryption keys, or Postman credentials are seeded. Provision accounts separately using your application's controlled setup process.

## Existing databases

The table migration preflights known column names/types/nullability, duplicate values for missing unique keys, and orphan foreign-key references before changing application tables. Unknown schema variants stop with a descriptive error for review. Knex itself can create its tracking tables before the application preflight.

Known upgrades rename `fisrtName`, add `personalBanksInfo` and the process-history table, correct onboarding approver width/default, allow repeated attendance records, and add lookup indexes. Existing text/date representations and application field names remain compatible. Existing table collations, extra non-unique indexes, and defaults other than the known onboarding defect are retained; fresh installations use `utf8mb4_0900_ai_ci` and InnoDB.

MySQL DDL commits implicitly, so these migrations disable Knex's DDL transaction wrapper. Keep a database backup before applying an upgrade. A stopped run can be retried after resolving the reported issue; completed changes are detected. Automatic `down` migrations deliberately fail rather than delete HR records or silently undo a reconciliation.

The routine migration does not replace an installed routine. Consequently, corrections included in the supplied routine baseline apply to missing routines/new installations only. Compare and review existing custom routines separately if you want to replace them.

## Validation

`tests/migrations.integration.js` tests a new schema, all 14 routine calls, API result shape, repeated attendance, non-destructive admin initialization, idempotency, upgrades from all three actual source DDLs with synthetic rows, preservation of existing procedures, and preflight rejection of schema drift/orphans.

It only connects to `127.0.0.1:17360`, checks the server's `@@datadir` against `MINI_HRMS_TEST_DATADIR`, and requires a directory whose name starts with `minihrms-migration-test-`. The schema test drops/recreates `mini_hrms` only in that isolated instance. The portal integration test uses `mini_hrms` locally and `railway` with `NODE_ENV=production`, with the same isolated-instance safeguard. Never point the test at an application instance.

After starting an isolated MySQL 8.0 instance with an empty temporary data directory and a test-only root account compatible with the installed driver:

```powershell
$env:MINI_HRMS_TEST_DATADIR = 'C:\path\to\minihrms-migration-test-unique-id'
$env:MINI_HRMS_SOURCE_DIR = 'E:\MEAN\Apps\MiNi HRMS'
npm.cmd run db:test
```

`MINI_HRMS_SOURCE_DIR` enables the three source-file upgrade cases; omit it to run the standalone synthetic tests. Shut down the isolated instance after testing.


Environment-target validation: all migrations and portal integration checks passed against both `mini_hrms` (development) and `railway` (production) in an isolated MySQL 8 instance. Ten deployment/configuration tests passed. No live database was renamed, copied or migrated as part of this configuration update.
