# Hootnshoot

Open-source social media scheduling and content creation platform. Schedule posts across Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Reddit, Threads, Pinterest and more, design media in a built-in canvas editor, and generate content with AI — all self-hosted, with **bring-your-own-key (BYOK)** API access.

Hootnshoot is a heavily extended fork of [Postiz](https://github.com/gitroomhq/postiz-app) (AGPL-3.0).

## BYOK first

Hootnshoot does not require any third-party API keys to boot. Each organization brings its own keys through **Settings → API Keys** inside the app:

| Key | Unlocks | Get one at |
|---|---|---|
| **Late API key** | Managed social channels (Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Reddit, Threads, Pinterest, WhatsApp + ads platforms) without registering your own OAuth apps | [getlate.dev](https://getlate.dev) |
| OpenAI API key | AI content generation, image generation | [platform.openai.com](https://platform.openai.com) |
| Gemini API key | AI image editing, captions | [aistudio.google.com](https://aistudio.google.com) |
| Replicate API token | AI object erase | [replicate.com](https://replicate.com) |

Keys are encrypted at rest and scoped to your organization. A server operator can optionally set the same keys as environment variables to act as a shared default for all organizations.

## Stack

- **Frontend**: Next.js (app router) — `app/apps/frontend`
- **Backend**: NestJS REST API — `app/apps/backend`
- **Orchestrator**: Temporal workflows for scheduled publishing — `app/apps/orchestrator`
- **Database**: PostgreSQL (Prisma) · **Cache/queues**: Redis
- **Storage**: local disk, Cloudflare R2, or Supabase Storage

## Quick start (Docker)

```bash
git clone https://github.com/solankiharsh/hootnshoot.git
cd hootnshoot
cp .env.example .env        # fill in JWT_SECRET, DATABASE_URL, etc.
docker compose up -d
```

The app is served on `http://localhost:4007`.

## Local development

```bash
cp .env.example .env
make env          # writes app/.env with local-infra overrides
make install      # pnpm install
make dev          # infra containers + frontend (4200) + backend (3000) + orchestrator
```

See [docs/setup.md](docs/setup.md) for details.

## Deploying with Cloudflare Tunnel

Expose your self-hosted instance on your own domain with no open ports — see [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

```bash
# after creating a tunnel in the Cloudflare Zero Trust dashboard
echo 'CLOUDFLARE_TUNNEL_TOKEN=<token>' >> .env
docker compose --profile tunnel up -d
```

## License

[AGPL-3.0](LICENSE). This project is a fork of [Postiz](https://github.com/gitroomhq/postiz-app); all modifications are published under the same license.
