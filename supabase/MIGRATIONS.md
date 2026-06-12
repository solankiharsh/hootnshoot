# Database migrations — when and how

Hootnshoot uses **two complementary paths**. They are not interchangeable for every change.

| Path | Source of truth | Applies to |
|------|-----------------|------------|
| **Prisma** (`schema.prisma`) | Almost all app tables, columns, indexes | Local Docker Postgres (`make prisma-push`) and **hosted Supabase Postgres** (via `DIRECT_DATABASE_URL`) |
| **Supabase SQL** (`supabase/migrations/*.sql`) | Storage buckets, Postgres enums/extensions Prisma cannot manage cleanly | **Hosted Supabase project** (`supabase db push`) and optional local Supabase stack |

After changing `DATABASE_URL` / `DIRECT_DATABASE_URL`, always re-run the correct push against that database before starting the app.

---

## When migrations are required

| You changed… | Local (`make dev`) | Hosted Supabase |
|--------------|-------------------|-----------------|
| `schema.prisma` (models, fields, indexes) | **Yes** — `make prisma-push` | **Yes** — `make prisma-push` with Supabase URLs in `app/.env`, **or** add a matching file under `supabase/migrations/` and `supabase db push` |
| Only `supabase/migrations/*.sql` (bucket, `ALTER TYPE`, RLS, etc.) | Only if you use `supabase start` locally | **Yes** — `supabase db push` |
| Switched DB target (new Supabase project / URLs) | **Yes** — `make env` then `make prisma-push` | **Yes** — push schema + Supabase migrations to the new project |
| App code only (no schema / SQL) | No | No |

**Current staged feature example:** `ComplianceJob.publishWhenApproved` is in Prisma **and** `supabase/migrations/20260515100000_add_compliance_job_publish_when_approved.sql`. Apply at least one path to the target DB before deploying app code that uses the column.

---

## 1. Local development (Docker Postgres)

Default flow from repo root:

```bash
make env          # writes app/.env → local postgres URLs (35432), redis, temporal
make prisma-push  # env + infra-up + prisma db push
make dev          # runs prisma-push first, then starts apps
```

- **Schema file:** `app/libraries/nestjs-libraries/src/database/prisma/schema.prisma`
- **Does not** run `supabase/migrations/` unless you use the Supabase local stack (below).

Verify:

```bash
./init.sh
```

---

## 2. Hosted Supabase (preview / production Postgres)

### Option A — Prisma push (recommended for `schema.prisma` changes)

1. Put **pooler** and **direct** URLs in root `.env` or `app/.env`:

   ```bash
   DATABASE_URL=postgresql://postgres.<ref>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
   DIRECT_DATABASE_URL=postgresql://postgres.<ref>@db.<ref>.supabase.co:5432/postgres
   ```

2. From repo root (recommended — avoids `app/.env` local overrides from `make env`):

   ```bash
   make prisma-push-supabase
   ```

   Or manually:

   ```bash
   cd app && pnpm run prisma-db-push
   ```

   Use **repo-root** `.env` for Supabase URLs. Root `.env` may be JSON or `KEY=value` lines. `app/.env` after `make env` points at local Docker Postgres; do not use it for hosted pushes.

   Prisma should use the **direct** host (`DIRECT_DATABASE_URL`, port 5432) when possible, not only the pooler.

3. Restart backend so the app picks up the schema.

**Do not commit** `.env` / `app/.env`.

### Option B — Supabase CLI migrations (`supabase/migrations/`)

Use when:

- Creating **Storage** buckets
- Adding **enum values** (e.g. `HELD_COMPLIANCE` on `"State"`)
- RLS policies, extensions, or other SQL Prisma does not own

**One-time setup:**

```bash
brew install supabase/tap/supabase   # or: npx supabase --help
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # ref = subdomain of https://<ref>.supabase.co
```

**Every time you add or change SQL under `supabase/migrations/`:**

```bash
cd /path/to/hootnshoot
supabase db push
```

Confirm in dashboard (Storage, SQL editor, etc.).

**Creating a new migration file:**

```bash
supabase migration new short_description
# edit supabase/migrations/<timestamp>_short_description.sql
supabase db push
```

Prefer **kebab-case** descriptions; timestamps are assigned by the CLI.

---

## 3. Local Supabase stack (optional)

Only if you run `supabase start` instead of Docker Postgres from `app/docker-compose.dev.yaml`:

```bash
supabase start
supabase db push    # applies supabase/migrations to local Supabase Postgres
```

Prisma can target that DB by pointing `DATABASE_URL` / `DIRECT_DATABASE_URL` at the ports in `supabase/config.toml` (default DB port `54322`).

---

## 4. Checklist before deploy

- [ ] `schema.prisma` changes pushed to **target** DB (`make prisma-push` locally, or `pnpm run prisma-db-push` in `app/` against Supabase)
- [ ] New files in `supabase/migrations/` applied on **hosted** project (`supabase db push`)
- [ ] `./init.sh` passes (or manual connection test)
- [ ] App starts without Prisma / column errors
- [ ] No secrets committed (`.env`, `.env.content-cop.local` stay gitignored)

---

## 5. Existing migration files

| File | Purpose |
|------|---------|
| `20260514100000_create_hootnshoot_media_bucket.sql` | Storage bucket `hootnshoot-media` |
| `20260514120000_add_held_compliance_state.sql` | `State` enum value `HELD_COMPLIANCE` |
| `20260515100000_add_compliance_job_publish_when_approved.sql` | `ComplianceJob.publishWhenApproved` (Post now) |

---

## 6. Troubleshooting

| Problem | What to do |
|---------|------------|
| App crashes: column/table does not exist | Run Prisma push (and Supabase migrations if the change is only in SQL) against the DB the app uses |
| `make prisma-push` fails: cannot connect | `make infra-up`; check `app/.env` points at `localhost:35432` |
| `supabase db push`: not linked | `supabase link --project-ref …` |
| Enum / bucket missing on Supabase but tables OK | Run `supabase db push`; Prisma does not apply those files |
| Pooled connection errors during push | Use `DIRECT_DATABASE_URL` for push; keep pooler URL for runtime `DATABASE_URL` |

For storage-only setup steps, see [README.md](./README.md).
