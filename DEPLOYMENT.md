# Deploying Heart Witness

## Hosting layout

- **Vercel:** Next.js pages, API routes, NextAuth, and social previews under one public domain.
- **Render:** one continuous background worker running moderation and illustration consumers from the same commit.
- **MongoDB Atlas:** application database.
- **Managed Redis:** BullMQ queues and submission limits; accessible by both hosts. Optional: with `QUEUE_BACKEND=mongo`, queues and limits live in MongoDB instead and no Redis is needed (see [Queue backend](#queue-backend)).
- **Cloudinary / Resend / AI providers:** existing image, email, and AI integrations.

This preparation does not provision paid services, publish the repository, or change DNS. Start with a staging deployment and separate database/Redis instances. Never attach a preview worker to production queues.

## Runtime and installation

Use Node.js **22.x**, matching `.nvmrc`, `package.json`, the Render Blueprint, and CI. Commit `package-lock.json`; installs use `npm ci`. The worker runs TypeScript with `tsx`, so the Render build deliberately includes development dependencies. The web build needs internet access to fetch the configured Google fonts.

Deployment preparation updates Next.js within version 15 and migrates validation to Zod 4. Package overrides select patched PostCSS, selector parser, and esbuild versions where upstream tools still pin vulnerable dependencies. Recheck these overrides when upgrading Next.js, Tailwind, or tsx. Use the committed lockfile rather than regenerating dependency versions on the host.

`npm run dev` writes to `.next-dev`; `npm run build` writes to `.next`. A production build can therefore run without overwriting the local development server's generated files.

## Environment variables

Use `.env.example` as a list of names, not production values. Configure production secrets in each hosting dashboard. No server credentials need a `NEXT_PUBLIC_` prefix. Do not copy `.env.local` into Git or deployment artifacts.

| Variable | Web | Worker | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | Required | Required | Same production database; configure least-privilege access and network rules for both hosts |
| `QUEUE_BACKEND` | Optional | Optional | `redis` (default) or `mongo`. **Set the same value on web and worker** |
| `REDIS_URL` | If `redis` | If `redis` | Same production instance; use its external TLS URL where hosts are on different networks. Not needed with `QUEUE_BACKEND=mongo` |
| `SITE_URL` | Required | Required | Public HTTPS origin, such as `https://your-domain.com`; no path |
| `NEXTAUTH_URL` | Required | — | Same origin as `SITE_URL` |
| `NEXTAUTH_SECRET` | Required | — | Generate at least 32 random bytes and retain across web redeployments |
| `ADMIN_EMAILS` | Required | — | Comma-separated **owner** emails. Owners are always admins and can't be removed from the website. Add further admins and moderators from **Team** (`/admin/team`) instead of here |
| `AI_PROVIDER` | — | Optional | `claude` (default) or `gemini` |
| `ANTHROPIC_API_KEY` | — | If Claude | Text moderation/scene description |
| `GEMINI_API_KEY` | — | Required | Illustration generation, plus text when Gemini is selected |
| `GEMINI_IMAGE_MODEL` | — | Optional | Existing default is defined in `lib/ai/illustrate.ts`; verify access in your provider account |
| `CLOUDINARY_CLOUD_NAME` | — | Required | Image storage |
| `CLOUDINARY_API_KEY` | — | Required | Image storage |
| `CLOUDINARY_API_SECRET` | — | Required | Image storage |
| `EMAIL_ENABLED` | — | Optional | Set `false` to launch without email; defaults to enabled when unset |
| `RESEND_API_KEY` | — | If email enabled | Author notifications |
| `EMAIL_FROM` | — | If email enabled | For example `Heart Witness <noreply@your-domain.com>`; verify the domain in Resend |
| `MODERATION_CONCURRENCY` | — | Optional | Default 3; integer 1–20 |
| `ILLUSTRATION_CONCURRENCY` | — | Optional | Default 2; integer 1–20 |
| `WORKER_IDLE_WAIT_SECONDS` | — | Optional | Default 120; 5–600. How long an idle worker waits on Redis before checking again. New jobs still start immediately; higher values mean fewer Redis commands |
| `WORKER_STALLED_CHECK_SECONDS` | — | Optional | Default 300; 30–3600. How often the worker looks for jobs abandoned by a crashed worker. Lower recovers faster but uses more Redis commands |

| `MONGO_QUEUE_POLL_SECONDS` | — | Optional | Default 5; 1–60. With `QUEUE_BACKEND=mongo`, how often an idle worker checks MongoDB for new jobs |

Redis usage: an idle worker process sends roughly 100,000 Redis commands a month with these defaults (it was about 2 million with BullMQ's own defaults). Run only one worker per Redis database, and use a separate Redis database for local development so testing doesn't use up production's allowance.

### Queue backend

`QUEUE_BACKEND` chooses where background jobs and submission rate limits are stored:

- **`redis`** (default): BullMQ on Redis, as described above.
- **`mongo`**: the `queue_jobs` and `rate_limits` collections in the app's MongoDB. No Redis service or `REDIS_URL` is needed, and there is no per-command quota. The worker checks for new jobs every `MONGO_QUEUE_POLL_SECONDS`, so a new story starts moderation within about 5 seconds instead of instantly.

Both backends keep the same behaviour: duplicate jobs are ignored, failed attempts retry with the same backoff (moderation 3 attempts, illustration 2), and jobs abandoned by a crashed worker are picked up again (Mongo: after their 10-minute lock expires). Finished moderation jobs are kept for 7 days and final failures for 30 days, then removed automatically; illustration jobs are removed when they finish.

To switch, set `QUEUE_BACKEND` on **both** the web host and the worker and redeploy both. Jobs already waiting in the old backend are not moved: let the queue drain first, or afterwards run `npm run queue:recover -- --apply` (moderation) and `npm run backfill-images -- --retry-failed` (images). Approved stories still owed an image are also re-queued automatically by the worker every 10 minutes.

Generate the authentication secret on your own machine with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, then save it directly in the web host's secret settings. Do not paste it into issues or logs.

Validation commands report variable names and errors without printing values:

```sh
npm run env:check -- --production
npm run env:check -- --worker --production
```

These validate configuration shape, not credentials, provider permissions, or connectivity. Local development does not enable production submission limits. Production permits one new submission or resubmission per signed-in user per hour; anonymous submissions are limited by client IP. The web deployment assumes Vercel sanitizes `x-forwarded-for`. If moving to another host, configure a trusted reverse proxy before relying on that header. Redis failures cause production submissions to return 503 before saving; a later queue failure after saving is handled through recovery below.

## Set up backing services first

1. Create a production MongoDB database user and permit both web and worker egress networks. Avoid a publicly unrestricted database allowlist; use provider-supported network controls where available. Enable backups and verify the restore procedure.
2. Provision BullMQ-compatible Redis with persistence and **`maxmemory-policy=noeviction`**. Enable TLS for connections over public networks. Size connections and storage for the web instances and worker consumers. Do not use Redis as a disposable cache for this application.
3. For an initial launch without email, set `EMAIL_ENABLED=false` on the worker and omit `RESEND_API_KEY`/`EMAIL_FROM`. Notifications are skipped, while moderation and illustrations continue. Authors check status in My stories. To enable notifications later, verify a sending domain in Resend, configure `RESEND_API_KEY` and `EMAIL_FROM`, and set `EMAIL_ENABLED=true` for a subsequent tagged release.
4. Configure Cloudinary and provider API credentials. Check AI model access and set spending/usage alerts.
5. Prefer nearby regions for web compute, MongoDB, Redis, and Render. `render.yaml` starts with Singapore; select available nearby regions for the other services.

## Create the web project on Vercel

1. Create/import this repository as a Next.js project and choose Node 22.x. Do not start an initial deployment; production releases are tag-triggered as described below.
2. Set the web variables above in the intended environment. Configure Preview separately using staging credentials and a staging domain; the production checks require public HTTPS origins.
3. Vercel reads `vercel.json`: install is `npm ci`; build is `npm run env:check -- --production && npm run build`.
4. Attach the public domain, apply the DNS records supplied by Vercel, and confirm HTTPS. Choose one canonical origin and redirect the alternate `www`/root domain to it.
5. Ensure `SITE_URL` and `NEXTAUTH_URL` match that canonical origin. Their new values take effect on the next tagged release. Until the custom domain is ready, use `https://echoes-of-kidness.vercel.app` for both.

The web application's `/api/health` returns 200 with `{ "status": "ok" }` and no secrets. It is a **liveness** check, not a MongoDB/Redis readiness check. Monitor dependencies independently and run an end-to-end smoke test.

## Deploy the worker on Render

1. Create a Blueprint from `render.yaml` in the same repository. It defines only the background worker and disables automatic commit deploys. Render may start an initial provisioning deployment when creating a service: keep production credentials unset until you deliberately release a tag. Do not create a second public web app there.
2. Review the selected instance and billing settings in Render before creating it. Supply worker variables when prompted. For Gemini text generation, set `AI_PROVIDER=gemini`; Anthropic is then unnecessary.
3. Build command: `npm ci --include=dev`. Start command: `npm run worker:production`, which validates the production environment before starting consumers.
4. The Blueprint starts with `EMAIL_ENABLED=false`; use the same setting for a manually created worker when deferring Resend. Confirm startup and Redis connectivity in logs. Keep at least one worker running continuously; it needs no public domain or inbound port.
5. Set Auto-Deploy to **Off** for an existing worker, too; editing the local Blueprint alone does not change an existing service until synced. Release the same commit to web and worker through the tag workflow below. Give workers time to finish active jobs during shutdown. Forced interruption can lead to reprocessing; BullMQ uses at-least-once delivery, so external AI/email calls are not guaranteed exactly once.

`SIGTERM`/`SIGINT` stop consumers from taking new jobs, wait for active jobs, then close producer connections and MongoDB. Platform shutdown deadlines still apply. Moderation updates are conditional on the submission remaining pending with unchanged content/revision, so a worker cannot overwrite an administrator's decision made during processing.

## Production releases are controlled by tags

Ordinary commits and branch pushes run validation only. `.github/workflows/release.yml` starts exclusively when a `v*` tag is pushed and accepts stable tags such as `v1.0.0`. The tagged commit must be on `main`. There is no manual workflow-dispatch trigger.

### One-time release setup

1. Commit the release workflow and host configs to `main` before creating a release tag. `vercel.json` sets `git.deploymentEnabled=false`; `render.yaml` sets `autoDeployTrigger=off`.
2. Disconnect the Vercel project's direct Git connection under **Settings → Git** to prevent other branches with older configs from creating direct deployments. The CLI release workflow still deploys to the existing project by ID. This connection removal must be confirmed in the dashboard; the local config alone is not a persisted dashboard setting.
3. Create a GitHub environment named `production` under repository **Settings → Environments**. Restrict deployment branches/tags to selected tags matching `v*`. Restrict who can create/change release tags with a repository tag ruleset. Optional required reviewers provide an additional approval step; the default workflow relies on the tag as authorization.
4. Add these secrets to the GitHub `production` environment:

   | Secret | Value |
   | --- | --- |
   | `VERCEL_TOKEN` | A Vercel access token belonging to the project owner; keep it private |
   | `VERCEL_ORG_ID` | Vercel team/account ID, available in team settings or `vercel link` output |
   | `VERCEL_PROJECT_ID` | Project ID from Vercel project settings |
   | `RENDER_API_KEY` | Render API key authorized to deploy the worker |
   | `RENDER_SERVICE_ID` | The worker service ID (`srv-...`) |

5. Configure application secrets in Vercel/Render as listed above. The workflow builds on Vercel so its build process can access Secret environment variables without exporting them to GitHub. Do not use `vercel pull` plus `vercel build` for this release: non-readable secrets can be exported as placeholders. Database and AI keys do not need to be duplicated as GitHub secrets.

Do not create a release tag until the accounts, runtime variables, worker service, and five workflow secrets are ready. Dashboard deployment buttons, CLI tokens, and administrators can still deploy manually; limiting those permissions is necessary if tag-only deployment must be enforced against other account holders.

### Your release command

After committing and pushing the desired changes to `main`, create and push the tag yourself:

```sh
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

Use a fresh version for each release. Creating a local tag alone does not deploy; pushing it starts **Release production** in GitHub Actions. Never move an already released tag to a different commit.

The workflow validates the tag and credentials, runs lint/tests/audit, and builds the tagged web app remotely with `vercel deploy --prod --skip-domain`. This creates a production-environment candidate without assigning the production domains. It then deploys that exact commit to Render and verifies it is live before promoting the Vercel candidate with `vercel promote`. Releases are serialized. If the worker fails or returns a different commit, production domain promotion does not start. An unpromoted candidate remains available at its unique deployment URL subject to project access controls. A later promotion failure can leave the worker upgraded while the web domain remains on its previous version: releases are not atomic across providers, so keep queue/database changes backward compatible and inspect both dashboards after failures. Retrying a run can redeploy the same commit. A fixed workflow must be committed and included in a fresh release tag; rerunning an old tag still uses its original workflow.

No release tag is created or pushed automatically. Host services and GitHub secrets are not provisioned by this workflow.

## Validation and release

The GitHub workflow runs lint, unit tests, a dependency audit, and a production build with dummy database settings. It does not access production data or call AI providers. Before promoting a release:

- Verify CI on Node 22 and run `npm audit`; review advisories before launch. Audit development dependencies too because the worker uses tsx at runtime.
- Open the homepage, browse/filter stories, and check an individual published story on mobile and desktop.
- Register a staging account, log in/out, and verify protected profile/admin routes.
- Submit one staging story and watch it proceed through moderation, publication, illustration, and email when enabled. With `EMAIL_ENABLED=false`, confirm author status updates without email-provider calls. Confirm the administrator can review a borderline story. This smoke test uses real provider quotas.
- Confirm another production-mode submission within the hour returns 429 and `Retry-After`. Use separate staging data; do not use real author submissions for testing.
- Check public social previews and copy/share links. See `SOCIAL_SHARING.md`.
- Set alerts for HTTP 5xx, oldest pending stories, failed jobs, Redis memory/connections, database connections, email delivery failures, and provider spending. Worker logs alone are not an alerting system.

## Recover pending moderation

If MongoDB saved a story but queueing failed, it remains pending. Run these commands in a trusted shell with the target environment configured; **the default is dry run**:

```sh
npm run queue:recover
npm run queue:recover -- --apply
# Explicitly retry failed moderation jobs after fixing their underlying cause:
npm run queue:recover -- --apply --retry-failed
```

Recovery considers submissions older than two minutes and skips stories with active/waiting/delayed jobs, including legacy job IDs. Deterministic revision IDs prevent concurrent recovery invocations from adding duplicate new jobs. Failed jobs require `--retry-failed`; existing completed jobs on a pending story are logged for manual investigation. Recovery can incur AI costs when `--apply` queues work. This is an operator command, not an automatic scheduler; alert on pending age and run it after queue incidents.

The existing `npm run backfill-images` and its `--retry-failed` option can queue missing/failed illustrations. They mutate data and may spend AI credits. Inspect pending image jobs separately before retrying them.

## Rollback

Retain the last known-good web deployment and worker commit. Stop further promotion, restore compatible web and worker revisions, then inspect pending/failed jobs. Do not purge Redis to roll back. Keep database/job changes backward compatible; a code rollback does not undo data changes or external emails/images. Back up MongoDB before future schema migrations.

## Provider references

- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render background workers](https://render.com/docs/background-workers)
- [BullMQ production settings](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
