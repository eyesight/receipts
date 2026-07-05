# ─── Config ───────────────────────────────────────────────────────────────────

# Resolve docker at parse time: prefer whatever is in PATH, fall back to the
# Docker Desktop bundle so the Makefile works before Docker.app creates its
# /usr/local/bin symlinks on first launch.
DOCKER     := $(shell command -v docker 2>/dev/null || echo /Applications/Docker.app/Contents/Resources/bin/docker)
# Ensure the credential helper (docker-credential-desktop) is also findable
# by prepending docker's own bin dir to PATH at runtime.
DOCKER_DIR := $(patsubst %/,%,$(dir $(DOCKER)))
DOCKER_CMD  = PATH="$(DOCKER_DIR):$$PATH" $(DOCKER)

DATABASE_URL := postgresql://postgres:postgres@localhost:5433/recipes_dev
export DATABASE_URL

-include apps/web/.env.local

.PHONY: dev build preview deploy deploy-images db\:up db\:down db\:reset db\:migrate db\:seed db\:studio help

# ─── Development ──────────────────────────────────────────────────────────────

## Start Docker services and the dev server
dev:
	$(MAKE) db\:up
	pnpm dev

## Build Astro app locally (output in apps/web/dist/)
build:
	pnpm build

## Preview the built dist/ locally
preview:
	pnpm preview

## Push to main and trigger GitHub Actions deploy
deploy:
	git push origin main

## Upload recipe images directly to FTP (no git required)
## Requires FTP_SERVER, FTP_USERNAME, FTP_PASSWORD in .env.local
deploy-images:
	@test -n "$(FTP_SERVER)" || (echo "Error: set FTP_SERVER, FTP_USERNAME, FTP_PASSWORD in .env.local"; exit 1)
	lftp -e " \
		set sftp:auto-confirm yes; \
		set sftp:connect-program \"ssh -oHostKeyAlgorithms=+ssh-rsa,ssh-dss -oKexAlgorithms=+diffie-hellman-group14-sha1\"; \
		set net:timeout 30; \
		set net:max-retries 2; \
		open sftp://$(FTP_USERNAME):$(FTP_PASSWORD)@$(FTP_SERVER):5544; \
		mirror -R apps/web/public/images/recipes/ images/recipes/; \
		quit"

# ─── Database ─────────────────────────────────────────────────────────────────

## Start PostgreSQL + Adminer in the background
db\:up:
	$(DOCKER_CMD) compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@until $(DOCKER_CMD) compose exec -T postgres pg_isready -U postgres -d recipes_dev > /dev/null 2>&1; do \
		printf '.'; sleep 1; \
	done
	@echo " ready."

## Stop and remove containers (data volume is kept)
db\:down:
	$(DOCKER_CMD) compose down

## Wipe the database, re-run migrations and seed data
db\:reset:
	$(MAKE) db\:down
	$(MAKE) db\:up
	$(MAKE) db\:migrate
	$(MAKE) db\:seed

## Run pending Drizzle migrations
db\:migrate:
	pnpm --filter @recipes/web run db:migrate

## Insert seed data (categories, tags, ingredients + seasonality)
db\:seed:
	pnpm --filter @recipes/web run db:seed

## Open Drizzle Studio — visual DB browser on http://local.drizzle.studio
db\:studio:
	pnpm --filter @recipes/web run db:studio

# ─── Help ─────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev           Start Docker + dev server"
	@echo "  build         Build Astro app locally"
	@echo "  preview       Preview the built dist/ locally"
	@echo "  deploy        Push to main (triggers GitHub Actions)"
	@echo "  deploy-images Upload recipe images directly to FTP"
	@echo "  db:up         Start PostgreSQL + Adminer (background)"
	@echo "  db:down       Stop containers"
	@echo "  db:reset      Wipe DB, migrate, seed"
	@echo "  db:migrate    Run pending migrations"
	@echo "  db:seed       Insert seed data"
	@echo "  db:studio     Open Drizzle Studio"
	@echo ""
