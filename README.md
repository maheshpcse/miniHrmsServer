# miniHrmsServer

## Database migrations

The final `mini_hrms` schema and upgrade instructions are in [database/README.md](database/README.md). See [source analysis](database/ANALYSIS.md) and the [data dictionary](database/DATA_DICTIONARY.md).

Run `npm run db:migrate:status` to inspect migration state and `npm run db:migrate` to apply the prepared migrations using your `.env` database connection.

## HR workspace

Run `npm run db:migrate` before starting the updated API. Migration `202609190003_people_workspace.js` adds authenticated sessions, server-verified recovery, requests, in-app notifications, configuration catalogs, and historical learning tables. Learning routes and API handlers have since been removed; historical migrations remain intact. New employee signups remain pending until HR approves their access request.

The portal uses `PORTAL_SECURITY_KEY` if set, otherwise the existing `SECURITY_KEY`. Recovery email uses `MAIL_NAME` / `MAIL_PASSWORD` and optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`. Tests inject a local mail adapter and do not send external email.

`npm run test:portal` requires the isolated MySQL test instance described in `database/README.md` and `MINI_HRMS_TEST_DATADIR`. Do not run it against an application database.

## Frontend connection and request logging

The Angular development server forwards `/api` to `http://127.0.0.1:3663` through its `proxy.conf.json`. Start this backend with `npm.cmd start` in a separate terminal. Restart both applications after changing proxy or server configuration.

Requests log their method, path, status and elapsed milliseconds to this terminal. Bodies, authorization headers and query strings are excluded from request logs. `/api/server` is the public health endpoint. Production hosting must forward `/api` to this server.

## Railway deployment

See [the Railway and GitHub Pages deployment guide](docs/DEPLOYMENT.md). Railway uses the Dockerfile and railway.json, runs migrations before deployment, and verifies database readiness.


Current Railway service settings and troubleshooting: [RAILWAY.md](RAILWAY.md).

