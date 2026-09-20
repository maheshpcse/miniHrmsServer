# Deploy MiNi HRMS: GitHub Pages + Railway

The Angular frontend runs on GitHub Pages. Express and MySQL run on Railway; GitHub Pages cannot run the backend or proxy `/api`.

## 1. Backend on Railway

Connect the **miniHrmsServer repository** to a Railway service. The checked-in `Dockerfile` and `railway.json` select Node 24, run `npm run deploy:prepare` (configuration validation followed by migrations) before deployment, start `node index.js`, and check `/api/health/ready`.

Add a MySQL 8 service in the same Railway project. Ensure a database named `mini_hrms` exists before deploying the API: migrations create tables, not the database. Set the database service's `MYSQL_DATABASE=mini_hrms` before its first initialization, or create that database using the database console. An existing volume is not renamed by changing that variable.

Set these variables on the **API service**:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DB_CLIENT` | `mysql2` |
| `DB_HOST` | Reference the MySQL service's `MYSQLHOST` |
| `DB_PORT` | Reference `MYSQLPORT` |
| `DB_USER` | Reference `MYSQLUSER` |
| `DB_PASSWORD` | Reference `MYSQLPASSWORD` |
| `DB_NAME` | `mini_hrms` |
| `CORS_ORIGINS` | `https://YOUR-ACCOUNT.github.io` (origin only, no repository path) |
| `TRUST_PROXY` | `1` for Railway's ingress |
| `SECURITY_KEY` | A strong random secret; preserve the existing key when migrating encrypted records |
| `PORTAL_SECURITY_KEY` | A separate strong random signing secret |

Railway references look like `${{MySQL.MYSQLHOST}}` when the database service is named `MySQL`. Use Railway's variable-reference picker for your service name. Railway provides `PORT` automatically. `.env.production.example` lists optional SMTP settings for password recovery. Keep secrets in Railway variables, never in the frontend or workflow.

Generate a public HTTPS domain for the API. Verify `https://YOUR-SERVICE.up.railway.app/api/health/ready` returns 200. A 503 means the database connection/schema is not ready; inspect deployment logs. Database migrations require permissions to create/alter tables and stored routines. Migration history is preserved across deployments.

A fresh schema contains configuration, not your employee/admin records. Import your existing database securely before opening the site to employees, and verify an active administrator can sign in. Migrations do not create a default-password account. Do not add database backups to GitHub or the Docker image. Persistent file uploads require a Railway volume mounted at `/app/uploads` if that legacy feature is used.

## 2. Frontend on GitHub Pages

In the **miniHrmsUI repository**:

1. Commit the deployment files and `package-lock.json` (now no longer ignored).
2. Open **Settings ? Pages ? Build and deployment** and select **GitHub Actions**.
3. Open **Settings ? Secrets and variables ? Actions ? Variables**, and add `API_URL=https://YOUR-SERVICE.up.railway.app/api`. This is a public URL, not a secret.
4. Push to `main`/`master`, or run **Deploy HRMS to GitHub Pages** from Actions. Adjust the workflow branch list if needed.

The workflow derives the repository base path from Pages settings. Routes use hashes in this build, for example `https://YOUR-ACCOUNT.github.io/miniHrmsUI/#/admin/login`, so refreshing a page does not require server rewrite rules. A custom Pages domain is supported; include its exact HTTPS origin in Railway `CORS_ORIGINS` (comma-separated if keeping both domains).

The workflow installs locked packages with Node 24 and builds this Angular 10 application using its pinned Node 12 build runtime. Node 12 is used only for the existing legacy build toolchain; Railway uses Node 24. Upgrading Angular remains separate work.

For a local production Pages build:

```powershell
$env:API_URL='https://YOUR-SERVICE.up.railway.app/api'
$env:PAGES_BASE_PATH='/miniHrmsUI/'
npm.cmd run build:pages
```

Output: `dist/miniHrmsUI`. The artifact contains a public `assets/runtime-config.js` and `.nojekyll`. Missing or invalid HTTPS API URLs fail the build. Normal `npm start` continues using the local Angular proxy; normal production builds retain `/api` unless runtime configuration is supplied.

## Repository layout

The workflow assumes miniHrmsUI is its own repository root; Railway assumes miniHrmsServer is its repository root. If you combine them into a monorepo, set the Railway service root to `/miniHrmsServer` and update workflow working directories, lockfile location and artifact path to `miniHrmsUI/...`. Place the workflow in the repository root's `.github/workflows`.

## Deployment status

Files are prepared locally; no GitHub repository settings, Railway services or live deployments were created. Configure the real API URL, database references and secrets in the hosting dashboards before deploying. Local validation results are recorded below when complete.

## Platform references

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Railway configuration reference](https://docs.railway.com/config-as-code/reference)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)

## Local validation completed

- Production Pages build passed with `/miniHrmsUI/` as its base path.
- A static HTTP server served the artifact without Angular dev-server rewrites. Login/signup routes, refresh, lazy-loaded code and the configured Railway API request URL passed browser checks.
- Backend migration/authentication/employee/request regression tests passed using MySQL2 against an isolated MySQL database.
- Production backend startup, database readiness, allowed-origin preflight, rejected origins and protected API responses passed.
- Docker image building and actual hosted deployment were not exercised locally; Docker is unavailable in this environment. The existing Angular HammerJS optimization warning is nonfatal.

For the current backend-specific settings and diagnostics, see [RAILWAY.md](../RAILWAY.md).
