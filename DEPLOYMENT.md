# Deploying Heart Witness

## Hosting layout

- **Vercel:** Next.js pages, API routes, NextAuth, and social previews under one public domain.
- **Render:** one continuous background worker running moderation and illustration consumers from the same commit.
- **MongoDB Atlas:** application database.
- **Managed Redis:** BullMQ queues and submission limits; accessible by both hosts.
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
| `REDIS_URL` | Required | Required | Same production instance; use its external TLS URL where hosts are on different networks |
| `SITE_URL` | Required | Required | Public HTTPS origin, such as `https://your-domain.com`; no path |
| `NEXTAUTH_URL` | Required | — | Same origin as `SITE_URL` |
| `NEXTAUTH_SECRET` | Required | — | Generate at least 32 random bytes and retain across web redeployments |
| `ADMIN_EMAILS` | Required | — | Comma-separated existing administrator account email addresses |
| `AI_PROVIDER` | — | Optional | `claude` (default) or `gemini` |
| `ANTHROPIC_API_KEY` | — | If Claude | Text moderation/scene description |
| `GEMINI_API_KEY` | — | Required | Illustration generation, plus text when Gemini is selected |
| `GEMINI_IMAGE_MODEL` | — | Optional | Existing default is defined in `lib/ai/illustrate.ts`; verify access in your provider account |
| `CLOUDINARY_CLOUD_NAME` | — | Required | Image storage |
| `CLOUDINARY_API_KEY` | — | Required | Image storage |
| `CLOUDINARY_API_SECRET` | — | Required | Image storage |
| `RESEND_API_KEY` | — | Required | Author notifications |
| `EMAIL_FROM` | — | Required | For example `Heart Witness <noreply@your-domain.com>`; verify the domain in Resend |
| `MODERATION_CONCURRENCY` | — | Optional | Default 3; integer 1–20 |
| `ILLUSTRATION_CONCURRENCY` | — | Optional | Default 2; integer 1–20 |

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
3. Verify the sending domain in Resend and add the required DNS records. Set `EMAIL_FROM` to that verified address.
4. Configure Cloudinary and provider API credentials. Check AI model access and set spending/usage alerts.
5. Prefer nearby regions for web compute, MongoDB, Redis, and Render. `render.yaml` starts with Singapore; select available nearby regions for the other services.

## Deploy the web app on Vercel

1. Import this repository as a Next.js project and choose Node 22.x.
2. Set the web variables above in the intended environment. Configure Preview separately using staging credentials and a staging domain; the production checks require public HTTPS origins.
3. Vercel reads `vercel.json`: install is `npm ci`; build is `npm run env:check -- --production && npm run build`.
4. Attach the public domain, apply the DNS records supplied by Vercel, and confirm HTTPS. Choose one canonical origin and redirect the alternate `www`/root domain to it.
5. Ensure `SITE_URL` and `NEXTAUTH_URL` match that canonical origin, then redeploy so metadata, authentication, and emails use it.

The web application's `/api/health` returns 200 with `{ "status": "ok" }` and no secrets. It is a **liveness** check, not a MongoDB/Redis readiness check. Monitor dependencies independently and run an end-to-end smoke test.

## Deploy the worker on Render

1. Create a Blueprint from `render.yaml` in the same repository. It defines only the background worker; do not create a second public web app there.
2. Review the selected instance and billing settings in Render before creating it. Supply worker variables when prompted. For Gemini text generation, set `AI_PROVIDER=gemini`; Anthropic is then unnecessary.
3. Build command: `npm ci --include=dev`. Start command: `npm run worker:production`, which validates the production environment before starting consumers.
4. Confirm startup and Redis connectivity in logs. Keep at least one worker running continuously; it needs no public domain or inbound port.
5. Deploy a compatible web/worker commit together. Initially keep promotion/deployment manual until CI is green. Give workers time to finish active jobs during shutdown. Forced interruption can lead to reprocessing; BullMQ uses at-least-once delivery, so external AI/email calls are not guaranteed exactly once.

`SIGTERM`/`SIGINT` stop consumers from taking new jobs, wait for active jobs, then close producer connections and MongoDB. Platform shutdown deadlines still apply. Moderation updates are conditional on the submission remaining pending with unchanged content/revision, so a worker cannot overwrite an administrator's decision made during processing.

## Validation and release

The GitHub workflow runs lint, unit tests, a dependency audit, and a production build with dummy database settings. It does not access production data or call AI providers. Before promoting a release:

- Verify CI on Node 22 and run `npm audit`; review advisories before launch. Audit development dependencies too because the worker uses tsx at runtime.
- Open the homepage, browse/filter stories, and check an individual published story on mobile and desktop.
- Register a staging account, log in/out, and verify protected profile/admin routes.
- Submit one staging story and watch it proceed through moderation, publication, illustration, and email. Confirm the administrator can review a borderline story. This smoke test uses real provider quotas.
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
