SHELL := /bin/sh

# Prefer Docker Compose when available, otherwise fall back to Podman Compose.
# Override if needed: `make infra-up COMPOSE=podman-compose`
COMPOSE ?= $(shell if command -v docker >/dev/null 2>&1; then printf '%s' 'docker compose'; elif command -v podman-compose >/dev/null 2>&1; then printf '%s' 'podman-compose'; else printf '%s' 'docker compose'; fi)
PNPM ?= pnpm

APP_DIR := app
ENV_FILE := .env
APP_ENV := $(APP_DIR)/.env
ROOT_COMPOSE := docker-compose.yaml
INFRA_COMPOSE := docker-compose.dev.yaml
INFRA_SERVICES := hootnshoot-postgres hootnshoot-redis temporal-elasticsearch temporal-postgresql temporal
# Do not `rm -rf dist` here: it races with the `until [ -f .../main.js ]` nodemon waiter
# (stale main.js can make `until` succeed, then dist is deleted, then node starts and crashes).
# Use `make clean-app-dist` when you need a clean SWC output tree.
BACKEND_SWC_WATCH := cross-env NODE_ENV=production swc apps/backend/src libraries/nestjs-libraries/src libraries/helpers/src -d apps/backend/dist --config-file apps/backend/.swcrc --watch
ORCHESTRATOR_SWC_WATCH := cross-env NODE_ENV=production swc apps/orchestrator/src apps/backend/src libraries/nestjs-libraries/src libraries/helpers/src -d apps/orchestrator/dist --config-file apps/orchestrator/.swcrc --watch

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available local development commands
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: env
env: ## Create app/.env for host dev from root .env plus local infra overrides
	@test -f "$(ENV_FILE)" || (echo "Missing $(ENV_FILE). Copy .env.example to .env and fill in your values." && exit 1)
	@cp "$(ENV_FILE)" "$(APP_ENV)"
	@printf '\n# Local Makefile overrides\n' >> "$(APP_ENV)"
	@printf 'DATABASE_URL=postgresql://hootnshoot-local:hootnshoot-local-pwd@localhost:35432/hootnshoot-db-local\n' >> "$(APP_ENV)"
	@printf 'DIRECT_DATABASE_URL=postgresql://hootnshoot-local:hootnshoot-local-pwd@localhost:35432/hootnshoot-db-local\n' >> "$(APP_ENV)"
	@printf 'REDIS_URL=redis://localhost:6380\n' >> "$(APP_ENV)"
	@printf 'TEMPORAL_ADDRESS=localhost:7233\n' >> "$(APP_ENV)"
	@printf 'BACKEND_INTERNAL_URL=http://localhost:3000\n' >> "$(APP_ENV)"
	@printf 'MAIN_URL=http://localhost:4200\n' >> "$(APP_ENV)"
	@printf 'FRONTEND_URL=http://localhost:4200\n' >> "$(APP_ENV)"
	@printf 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3000\n' >> "$(APP_ENV)"
	@printf 'NOT_SECURED=true\n' >> "$(APP_ENV)"
	@printf 'IS_GENERAL=true\n' >> "$(APP_ENV)"
	@printf 'DISABLE_REGISTRATION=false\n' >> "$(APP_ENV)"
	@printf 'STORAGE_PROVIDER=local\n' >> "$(APP_ENV)"
	@printf 'UPLOAD_DIRECTORY=./.local/uploads\n' >> "$(APP_ENV)"
	@printf 'NEXT_PUBLIC_UPLOAD_DIRECTORY=/uploads\n' >> "$(APP_ENV)"
	@printf 'NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY=/uploads\n' >> "$(APP_ENV)"
	@printf 'COMPLIANCE_ENABLED=true\n' >> "$(APP_ENV)"
	@if [ -f ".env.content-cop.local" ]; then \
		printf '\n# Merged from repo-root .env.content-cop.local (Content Cop HTTPS webhook base)\n' >> "$(APP_ENV)" && \
		cat .env.content-cop.local >> "$(APP_ENV)"; \
	fi
	@mkdir -p "$(APP_DIR)/.local/uploads"
	@echo "Wrote $(APP_ENV) for local host development."

.PHONY: install
install: ## Install pnpm dependencies on the host
	@cd "$(APP_DIR)" && $(PNPM) install

.PHONY: colima
colima: ## Start Colima (Docker on macOS); run before infra-up / dev if Docker is unavailable
	@command -v colima >/dev/null 2>&1 || (echo "Install Colima: brew install colima docker-compose" && exit 1)
	colima start

.PHONY: podman-ready
podman-ready: ## Ensure Podman machine VM is running (macOS; auto-run before infra-up)
	@if ! echo "$(COMPOSE)" | grep -q podman; then exit 0; fi; \
	command -v podman >/dev/null 2>&1 || { echo "podman-compose is selected but podman is not installed."; exit 1; }; \
	if podman ps >/dev/null 2>&1; then \
		echo "Podman machine OK."; \
	else \
		echo "Podman machine not reachable — starting VM..."; \
		podman machine start 2>/dev/null || true; \
		if ! podman ps >/dev/null 2>&1; then \
			echo "Still unreachable — restarting Podman machine (stop + start)..."; \
			podman machine stop 2>/dev/null || true; \
			podman machine start; \
		fi; \
		i=0; while ! podman ps >/dev/null 2>&1; do \
			i=$$((i + 1)); \
			if [ $$i -gt 90 ]; then echo "Podman machine did not become ready in 90s."; exit 1; fi; \
			sleep 1; \
		done; \
		echo "Podman machine ready."; \
	fi

.PHONY: infra-up
infra-up: podman-ready ## Start only local infrastructure containers; no app image build
	@docker ps --format '{{.ID}} {{.Ports}}' 2>/dev/null | awk '/0\.0\.0\.0:35432->/' | awk '{print $$1}' | xargs -r docker stop 2>/dev/null || true
	@lsof -ti :35432 2>/dev/null | xargs kill -9 2>/dev/null || true
	@cd "$(APP_DIR)" && $(COMPOSE) -f "$(INFRA_COMPOSE)" up -d $(INFRA_SERVICES)

.PHONY: infra-down
infra-down: ## Stop local infrastructure containers
	@cd "$(APP_DIR)" && $(COMPOSE) -f "$(INFRA_COMPOSE)" down

.PHONY: infra-logs
infra-logs: ## Follow local infrastructure logs
	@cd "$(APP_DIR)" && $(COMPOSE) -f "$(INFRA_COMPOSE)" logs -f $(INFRA_SERVICES)

.PHONY: infra-ps
infra-ps: ## Show local infrastructure container status
	@cd "$(APP_DIR)" && $(COMPOSE) -f "$(INFRA_COMPOSE)" ps

.PHONY: prisma-push
prisma-push: env infra-up ## Push Prisma schema to local Postgres
	@cd "$(APP_DIR)" && $(PNPM) run prisma-db-push

.PHONY: prisma-push-supabase
prisma-push-supabase: ## Push Prisma schema to hosted Supabase (reads repo-root .env only)
	@node scripts/prisma-push-supabase.mjs

.PHONY: supabase-migrations
supabase-migrations: ## Apply supabase/migrations/*.sql to hosted DB (no supabase login)
	@node scripts/apply-supabase-migrations.mjs

.PHONY: clean-app-dist
clean-app-dist: ## Remove backend and orchestrator SWC dist dirs (run before dev if builds act stale)
	rm -rf "$(APP_DIR)/apps/backend/dist" "$(APP_DIR)/apps/orchestrator/dist"

.PHONY: dev
dev: prisma-push ## Fast local dev: run frontend, backend, and orchestrator from source
	@echo "Freeing ports 3000 and 4200..."
	@lsof -ti :3000 :4200 2>/dev/null | xargs kill -9 2>/dev/null || true
	@docker ps --filter "publish=3000" --format "{{.Names}}" 2>/dev/null | xargs -r docker stop 2>/dev/null || true
	@cd "$(APP_DIR)" && $(PNPM) exec concurrently -n frontend,backend-build,backend,orchestrator-build,orchestrator \
		"$(PNPM) --filter ./apps/frontend run dev" \
		"$(BACKEND_SWC_WATCH)" \
		"sh -c 'until [ -s apps/backend/dist/apps/backend/src/main.js ]; do sleep 1; done; $(PNPM) exec nodemon --watch apps/backend/dist --delay 1 --exec \"$(PNPM) --filter ./apps/backend run start\"'" \
		"$(ORCHESTRATOR_SWC_WATCH)" \
		"sh -c 'until [ -s apps/orchestrator/dist/apps/orchestrator/src/main.js ]; do sleep 1; done; $(PNPM) exec nodemon --watch apps/orchestrator/dist --delay 1 --exec \"$(PNPM) --filter ./apps/orchestrator run start\"'"

.PHONY: dev-backend
dev-backend: prisma-push ## Fast local dev: run frontend and backend from source
	@echo "Freeing ports 3000 and 4200..."
	@lsof -ti :3000 :4200 2>/dev/null | xargs kill -9 2>/dev/null || true
	@docker ps --filter "publish=3000" --format "{{.Names}}" 2>/dev/null | xargs -r docker stop 2>/dev/null || true
	@cd "$(APP_DIR)" && $(PNPM) exec concurrently -n frontend,backend-build,backend \
		"$(PNPM) --filter ./apps/frontend run dev" \
		"$(BACKEND_SWC_WATCH)" \
		"sh -c 'until [ -s apps/backend/dist/apps/backend/src/main.js ]; do sleep 1; done; $(PNPM) exec nodemon --watch apps/backend/dist --delay 1 --exec \"$(PNPM) --filter ./apps/backend run start\"'"

.PHONY: build
build: ## Build frontend, backend, and orchestrator locally without building an image
	@cd "$(APP_DIR)" && $(PNPM) run build

.PHONY: image-up
image-up: ## Start compose using the existing image; no rebuild
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" up

.PHONY: image-build
image-build: ## Build the app image explicitly
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" build hootnshoot

.PHONY: image-rebuild
image-rebuild: ## Rebuild and recreate the app image explicitly
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" up --build --force-recreate

.PHONY: restart-app
restart-app: ## Restart the existing application container; no rebuild
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" restart hootnshoot

.PHONY: logs
logs: ## Follow app container logs
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" logs -f hootnshoot

.PHONY: dev-log
dev-log: env infra-up ## Like dev, but tee all output to .logs/hootnshoot-dev.log (run log-follow in a second terminal)
	@mkdir -p .logs
	@lsof -ti :3000 :3002 2>/dev/null | xargs kill -9 2>/dev/null || true
	@cd "$(APP_DIR)" && $(PNPM) exec concurrently -n frontend,backend-build,backend,orchestrator-build,orchestrator \
		"$(PNPM) --filter ./apps/frontend run dev" \
		"$(BACKEND_SWC_WATCH)" \
		"sh -c 'until [ -s apps/backend/dist/apps/backend/src/main.js ]; do sleep 1; done; $(PNPM) exec nodemon --watch apps/backend/dist --delay 1 --exec \"$(PNPM) --filter ./apps/backend run start\"'" \
		"$(ORCHESTRATOR_SWC_WATCH)" \
		"sh -c 'until [ -s apps/orchestrator/dist/apps/orchestrator/src/main.js ]; do sleep 1; done; $(PNPM) exec nodemon --watch apps/orchestrator/dist --delay 1 --exec \"$(PNPM) --filter ./apps/orchestrator run start\"'" \
		2>&1 | tee "../.logs/hootnshoot-dev.log"

.PHONY: log-follow
log-follow: ## Tail structured hootnshoot.post.* events from .logs/hootnshoot-dev.log (run while dev-log is active)
	@tail -f .logs/hootnshoot-dev.log | grep --line-buffered '"event":"hootnshoot'

.PHONY: ps
ps: ## Show compose status
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" ps

.PHONY: stop
stop: ## Kill dev processes (backend, frontend, orchestrator) on their default ports
	@echo "Killing processes on ports 3000 (backend), 3002 (orchestrator), 4200 (frontend)..."
	@lsof -ti :3000 :3002 :4200 2>/dev/null | xargs kill -9 2>/dev/null || true
	@echo "Done."

.PHONY: down
down: ## Stop full compose stack
	@$(COMPOSE) --env-file "$(ENV_FILE)" -f "$(ROOT_COMPOSE)" down
