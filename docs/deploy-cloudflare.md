# Deploying Hootnshoot with Cloudflare Tunnel

Run the full Hootnshoot stack on any machine you control (a VPS, a home server, a spare Mac) and expose it on your own domain through a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — no open inbound ports, free TLS, and Cloudflare's network in front.

## Prerequisites

- A Cloudflare account with your domain added (free plan is fine)
- Docker + Docker Compose on the host machine
- A PostgreSQL database (any provider — Supabase, Neon, RDS, or self-hosted)

## 1. Create the tunnel

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**
2. Choose **Cloudflared**, name it (e.g. `hootnshoot`), and copy the tunnel token (`eyJ...`)
3. Under **Public Hostname**, add a hostname:
   - **Subdomain/domain**: e.g. `hootnshoot.yourdomain.com`
   - **Service**: `HTTP` → `hootnshoot:5000`
     (the compose network resolves `hootnshoot` to the app container; nginx inside it listens on 5000)

## 2. Configure the environment

```bash
cp .env.example .env
```

Set at minimum:

```bash
JWT_SECRET=$(openssl rand -hex 64)
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...
TEMPORAL_POSTGRES_PASSWORD=$(openssl rand -hex 32)

MAIN_URL=https://hootnshoot.yourdomain.com
FRONTEND_URL=https://hootnshoot.yourdomain.com
NEXT_PUBLIC_BACKEND_URL=https://hootnshoot.yourdomain.com/api

CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

> **BYOK**: you do not need any Late/OpenAI/Gemini/Replicate keys in `.env`. Each
> workspace adds its own keys in **Settings → API Keys** inside the app. Env vars
> act only as optional server-wide defaults.

`NEXT_PUBLIC_BACKEND_URL` is baked into the frontend at build time, so set it
**before** the first `docker compose up`.

## 3. Push the database schema

```bash
cd app && pnpm install && DATABASE_URL=... DIRECT_DATABASE_URL=... pnpm run prisma-db-push
```

(or `make prisma-push-supabase` if you use Supabase with a repo-root `.env`)

## 4. Start the stack with the tunnel

```bash
docker compose --profile tunnel up -d --build
```

This starts the app (frontend + backend + orchestrator in one container), Redis, the Temporal stack, and `cloudflared`. Within a minute the tunnel shows **HEALTHY** in the Zero Trust dashboard and `https://hootnshoot.yourdomain.com` serves the app.

## Optional: Cloudflare R2 for media storage

Local disk storage works out of the box (`STORAGE_PROVIDER=local`). For durable object storage, create an R2 bucket and an R2 API token (Account → R2 → Manage API Tokens), then set:

```bash
STORAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ACCESS_KEY=...          # R2 access key id
CLOUDFLARE_SECRET_ACCESS_KEY=...   # R2 secret
CLOUDFLARE_BUCKETNAME=hootnshoot
CLOUDFLARE_BUCKET_URL=https://<public-bucket-url>/
CLOUDFLARE_REGION=auto
```

## Troubleshooting

- **Tunnel shows DOWN**: check `docker logs hootnshoot-cloudflared` — an invalid token is the usual cause.
- **App loads but API calls fail**: `NEXT_PUBLIC_BACKEND_URL` must be the public HTTPS URL ending in `/api`, and it must have been set at build time (`docker compose build` again after changing it).
- **OAuth redirects go to localhost**: `FRONTEND_URL`/`MAIN_URL` must be the public hostname.
- **Managed channels missing a key**: that's BYOK working — add a Late API key in Settings → API Keys (or set `LATE_API_KEY` server-wide).
