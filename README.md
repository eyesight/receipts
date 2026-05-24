# Recipes

A Swiss recipe app with OCR import, seasonal suggestions, and an AI-powered shopping assistant.

## Stack

- **Frontend** — [Astro](https://astro.build) + React + Tailwind CSS
- **Database** — PostgreSQL 16 via [Drizzle ORM](https://orm.drizzle.team)
- **AI** — Anthropic Claude (OCR, recipe parsing)
- **Storage** — Cloudflare R2 (images)
- **Deployment** — Cloudflare Workers

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| [Node.js](https://nodejs.org) | 20 |
| [pnpm](https://pnpm.io) | 9 |
| [Docker](https://www.docker.com/get-started/) | 24 (for local Postgres) |

---

## Local setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd receipts
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in the required values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (pre-filled for local Docker) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com) |
| `R2_BUCKET_URL` | R2 / MinIO endpoint (pre-filled for local MinIO) |
| `R2_ACCESS_KEY` | R2 access key |
| `R2_SECRET_KEY` | R2 secret key |
| `PUBLIC_BASE_URL` | Base URL shown in links (default: `http://localhost:4321`) |

### 3. Start the database

```bash
make db:up
```

This starts PostgreSQL 16 and Adminer in Docker. PostgreSQL will be available on `localhost:5433` and the Adminer UI on <http://localhost:8080>.

### 4. Run migrations

```bash
make db:migrate
```

### 5. Seed initial data

```bash
make db:seed
```

Inserts 5 categories, 10 tags, and 5 ingredients with full Swiss seasonality data.

### 6. Start the dev server

```bash
pnpm dev
# or, to start Docker + dev server together:
make dev
```

The app is now running at <http://localhost:4321>.

---

## Database commands

| Command | Description |
|---|---|
| `make db:up` | Start PostgreSQL + Adminer in the background |
| `make db:down` | Stop containers (data volume is preserved) |
| `make db:reset` | Wipe DB, re-run migrations and seed |
| `make db:migrate` | Apply pending Drizzle migrations |
| `make db:seed` | Insert seed data |
| `make db:studio` | Open Drizzle Studio at <http://local.drizzle.studio> |

### Adminer (quick DB inspection)

Go to <http://localhost:8080> and log in with:

- **System** — PostgreSQL
- **Server** — `postgres`
- **Username** — `postgres`
- **Password** — `postgres`
- **Database** — `recipes_dev`

### Drizzle Studio (full-featured visual editor)

```bash
make db:studio
```

### Generating a new migration after schema changes

```bash
cd apps/web
npx drizzle-kit generate
```

Review the generated SQL in `apps/web/drizzle/`, then apply it with `make db:migrate`.

---

## Project structure

```
receipts/
├── apps/
│   └── web/               # Astro app
│       ├── drizzle/        # Migration files
│       ├── src/
│       │   ├── lib/db/     # Schema, queries, seed
│       │   └── ...
│       ├── drizzle.config.ts
│       └── .env.local      # Local environment (not committed)
├── packages/
│   └── shared/             # Shared Zod schemas + TypeScript types
├── docker-compose.yml
├── Makefile
└── pnpm-workspace.yaml
```

---

## Roadmap

| Phase | Feature |
|---|---|
| **Phase 1** | OCR recipe import, seasonal suggestions, full-text search |
| **Phase 2** | User favourites |
| **Phase 3** | Pantry tracking, shopping lists, Coop/Migros price bot, vector search |
