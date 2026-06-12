# Self-hosting Hootnshoot

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm (for local development)
- PostgreSQL, Redis, and Temporal (provided via Docker Compose)

## Quick start (local)

1. Copy the environment template and fill in your values:

```bash
cp app/.env.example app/.env
```

2. Start infrastructure services:

```bash
make infra-up
```

3. Start the application:

```bash
make dev-backend
```

The frontend will be available at `http://localhost:4200` and the backend at `http://localhost:3000`.

## Production deployment

Use the `docker-compose.yaml` at the repo root. Set all required environment variables (see `app/.env.example`) and run:

```bash
docker compose up -d
```

Configure a reverse proxy (nginx, Caddy, Traefik, Cloudflare Tunnel, etc.) to route:

- `https://app.yourdomain.com` → port 4200 (frontend)
- `https://api.yourdomain.com` → port 3000 (backend)

## Required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random secret for JWT tokens |
| `FRONTEND_URL` | Public URL of the frontend |
| `NEXT_PUBLIC_BACKEND_URL` | Public URL of the backend API |
| `GEMINI_API_KEY` | Google Gemini API key (AI captions) |

See `app/.env.example` for the full list including optional integrations.

## Optional integrations

- **Compliance checking**: Set `CONTENT_COP_API_KEY` and `CONTENT_COP_BASE_URL`
- **Image generation (Gener8)**: Set `GENER8_API_KEY` and `GENER8_BASE_URL`
- **Video generation (Aurora)**: Set `AURORA_API_KEY` and `AURORA_BASE_URL`
- **Logo substitution in design pipeline**: Set `ORG_LOGO_URL` to a public URL of your org logo
