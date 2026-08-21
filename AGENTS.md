<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-context -->

# Deployment & Server Context (persistent memory)

- **Hosting:** The app runs on a remote server via **Coolify** (`tip-ai.burakpehlivan.dev`). Every push to `master` triggers a Coolify GitHub webhook → auto-deploy to production.
- **Database:** PostgreSQL runs on the same server (Coolify-managed container `tip-ai-postgres`, internal network `tip-ai-postgres:5432`, db/user `tip_ai`). Postgres is the single source of truth for cases/users/attempts; JSON file-store mode was removed in production (`STORE_MODE=postgres`).
- **Server AI agent:** An AI agent is available ON the server for operations. When server-side work is needed (logs, DB queries, container inspection, env changes), produce the prompt **in English** for the user to paste into that agent; the user will paste back its output. All other communication stays in Turkish.
- **Key paths on server:** app data volume `/data/coolify/applications/ga403qren9bf2yzsot8ox7cl/data` → container `/app/data`; PTB-XL dataset at `data/raw/ptbxl/` (records100 + ptbxl_database.csv); legacy JSON archived in `data/admin/_archive_json_2026-08-21/`.
- **Verification after deploy:** `GET /api/health/ready` must return 200 with all stores `postgres`; check container logs for `[migrate] migration'lar tamamlandı`.
- **UI testing protocol:** All UI/UX verification runs against the production site (`https://tip-ai.burakpehlivan.dev`), never localhost. Log in as a regular user with the test credentials stored in gitignored `.env.local` (`TIPAI_TEST_USER` / `TIPAI_TEST_PASS`) — never hardcode or commit them.
- **Auto-push:** After completing code changes, commit and push to `master` immediately without waiting for user approval (pre-approved by user). Push = production deploy via Coolify webhook.
- **Prod verification flow:** State exactly which change will be verified on prod and the test plan, then stop and wait until the user confirms the deploy finished before running the checks.

<!-- END:deployment-context -->
