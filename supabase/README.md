# Supabase CLI

**Full guide (Prisma vs Supabase, local vs hosted, when required):** [MIGRATIONS.md](./MIGRATIONS.md)

The migration `migrations/20260514100000_create_hootnshoot_media_bucket.sql` creates the **`hootnshoot-media`** bucket (same id as `SUPABASE_STORAGE_BUCKET` in Terraform).

## Apply to your hosted project

1. Install the CLI: [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase` or use `npx supabase`).

2. Log in and link this repo to your project (project ref is the subdomain in `https://<ref>.supabase.co`):

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Push migrations to the linked remote database:

   ```bash
   supabase db push
   ```

4. Confirm in the dashboard: **Storage** → you should see **`hootnshoot-media`**.

If you use a different bucket name in `.env` / ECS, either change the migration (and re-push) or create a second bucket with that exact id.

## Local Supabase only

If you run `supabase start` locally, the same migration applies when you reset or migrate the local DB.
