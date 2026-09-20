# Railway backend deployment

Deploy repository `maheshpcse/miniHrmsServer`, branch **main**.

| Railway setting | Value |
| --- | --- |
| Root Directory | `/` for this backend repository |
| Config File | `/railway.json` |
| Builder | Dockerfile (configured in railway.json) |
| Pre-deploy | `npm run deploy:prepare` |
| Start | `node index.js` |
| Healthcheck | `/api/health/ready` |
| Healthcheck timeout | 120 seconds |

The image installs dependencies in a build stage and runs as the non-root `node` user in a separate runtime stage. The runtime does not contain the compiler toolchain. Node runs directly so Railway shutdown signals reach the application.

## Variables

Use `.env.production.example` as a reference; configure values in Railway Variables rather than uploading `.env`.

- `NODE_ENV=production`, `HOST=0.0.0.0`, `DB_CLIENT=mysql2` are image defaults.
- Set `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` using references to your Railway MySQL service.
- Set `DB_NAME=mini_hrms`. Create this database before the first API deployment; the migration creates tables, not the database itself.
- Set `PORTAL_SECURITY_KEY` to a strong random secret. The existing `SECURITY_KEY` is a fallback; preserve it when moving encrypted legacy records.
- Set `CORS_ORIGINS=https://maheshpcse.github.io`. Add any custom frontend origins separated by commas. Do not include `/miniHrmsUI`, a fragment, or a trailing slash.
- Set `TRUST_PROXY=1` for Railway ingress.
- Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=15` so graceful shutdown has time to finish.
- Leave `PORT` unset; Railway supplies it.
- Configure the SMTP variables only if using password recovery email.

`npm run deploy:check` verifies required configuration without connecting to the database or printing values. `npm run deploy:prepare` validates the configuration, applies pending migrations, and exits nonzero if either step fails. Railway then stops the deployment before replacing the running service. Configure a 300-second Pre-deploy Timeout in Railway's service settings, adjusting for database size if needed.

Generate a public Railway HTTPS domain and set the frontend GitHub Actions variable `API_URL` to `https://YOUR-DOMAIN/api`. The frontend is hosted on GitHub Pages; the backend runs on Railway.

## Checks and troubleshooting

- `/api/server` reports that Express is available; `/api/health/ready` also verifies database/schema access.
- If pre-deploy validation fails, its message names the missing or invalid variables.
- If migrations fail, check database connectivity, `mini_hrms` existence, migration privileges and whether another deployment holds the migration lock. Do not blindly force-unlock a running migration.
- A browser CORS error means the frontend's exact origin is missing from `CORS_ORIGINS`.
- Existing user records are not copied by migrations. Import your existing data securely and confirm administrator access before opening the site to users.
- Legacy file uploads need persistent storage mounted at `/app/uploads`, writable by the container's `node` user.

Local validation: six configuration tests pass with `npm run test:deployment`; the pre-deploy script passes Node syntax validation. Docker image builds and live Railway deployment require the hosting environment and were not run for this update.

References: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [Railway variables](https://docs.railway.com/variables/reference).

## GitHub Actions triggers

The backend workflow is `.github/workflows/backend-ci.yml`. It runs on pushes to `main` and `master`, pull requests targeting those branches, and manual runs from the Actions tab. There are no path filters. GitHub requires an actual workflow YAML file; `railway.json` alone never creates an Actions run.

The workflow installs the lockfile, runs deployment configuration tests, checks JavaScript syntax, builds the Railway Docker image, and validates the image with synthetic configuration. It does not run migrations against production or require live secrets.

For automatic production deployment, connect this repository to the Railway API service, choose branch `main`, enable automatic deployments, and enable **Wait for CI** if deployment should wait for the Backend CI check. These are Railway service settings, not GitHub Pages settings. Do not enable GitHub Pages for this backend.

If a future push creates no run, check GitHub **Settings ? Actions ? General** allows Actions, the push targets a configured branch and the pushed commit contains the workflow. Skip-CI commit messages and pushes made with GitHub's `GITHUB_TOKEN` can suppress runs. A failed CI run is a separate issue from a workflow not triggering.

References: [GitHub workflow triggers](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows), [Railway GitHub autodeploys](https://docs.railway.com/guides/github-autodeploys).
