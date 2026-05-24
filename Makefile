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

.PHONY: dev db\:up db\:down db\:reset db\:migrate db\:seed db\:studio help

# ─── Development ──────────────────────────────────────────────────────────────

## Start Docker services and the dev server
dev:
	$(MAKE) db\:up
	pnpm dev

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
	@echo "  db:up         Start PostgreSQL + Adminer (background)"
	@echo "  db:down       Stop containers"
	@echo "  db:reset      Wipe DB, migrate, seed"
	@echo "  db:migrate    Run pending migrations"
	@echo "  db:seed       Insert seed data"
	@echo "  db:studio     Open Drizzle Studio"
	@echo ""
