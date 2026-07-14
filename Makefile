# GYF developer tasks. Run `make` or `make help` for the list.
# Toolchain: Bun 1.1+ (JS workspaces), uv (Python/API), Apple `container` (local infra).

.DEFAULT_GOAL := help
SHELL := bash
API_DIR := services/api
WEB_DIR := app

# Same macOS lock hits ~/.cache (uv) and ~/.cache/huggingface. Redirect every
# cache the Python/ML toolchain touches at gitignored, repo-local dirs so the API
# boots without manual env. Drop these once ~/.cache is writable again.
CACHE_ENV := UV_CACHE_DIR=$(CURDIR)/.uv-cache XDG_CACHE_HOME=$(CURDIR)/.cache-local HF_HOME=$(CURDIR)/.hf-cache

# Persist behavioral events to the interactions table so the taste loop closes on the
# host dev path too (save → interactions → next recommend personalizes). Without this
# the bare default is a local file sink the taste model never reads. The Docker stack
# sets the same via compose/Dockerfile env.
DEV_ENV := $(CACHE_ENV) GYF_EVENT_SINK=postgres

# Local stack runs on Apple `container` (no Docker). infra/container-stack.sh is the
# compose replacement — it orchestrates the same images/env/ports/mounts with explicit
# health-wait loops and gyf.test service-name DNS. Requires `container system start`.
STACK := bash infra/container-stack.sh

.PHONY: data-export help install check-uv migrate dev dev-web dev-api up down logs stack stack-down stack-logs nuke fmt fmt-check lint typecheck test test-api doctrine ci types m2-bakeoff m2-clean clean deploy-web deploy-web-preview

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: check-uv ## Install all dependencies (JS workspaces + Python API)
	bun install
	cd $(API_DIR) && uv sync --extra dev --extra postgres --extra migrate

check-uv: ## Verify the uv toolchain is installed (fail with install hint otherwise)
	@command -v uv >/dev/null 2>&1 || { \
		echo "error: 'uv' is not installed — the Python toolchain needs it."; \
		echo "  install: curl -LsSf https://astral.sh/uv/install.sh | sh"; \
		exit 1; }

migrate: check-uv ## Apply DB migrations (alembic) to GYF_DATABASE_URL
	cd $(API_DIR) && $(CACHE_ENV) uv run --extra postgres --extra migrate python -m alembic upgrade head

dev: check-uv ## Boot web + API together (Ctrl-C stops both)
	@echo "web → http://localhost:3000   api → http://localhost:8000"
	@trap 'kill 0' EXIT; \
		( cd $(API_DIR) && $(DEV_ENV) uv run --extra postgres --extra migrate uvicorn app.main:app --reload --port 8000 ) & \
		bun run dev & \
		wait

dev-web: ## Run only the web app
	bun run dev

deploy-web: ## Deploy web to Vercel prod (project gyf-v2-app; NEXT_PUBLIC_* come from the Vercel project env). Normally Git auto-deploys on push.
	cd $(WEB_DIR) && vercel --prod

deploy-web-preview: ## Build + deploy a Vercel preview (no prod promote)
	cd $(WEB_DIR) && vercel

dev-api: check-uv ## Run only the API service
	cd $(API_DIR) && $(DEV_ENV) uv run --extra postgres --extra migrate uvicorn app.main:app --reload --port 8000

up: ## Start local infra only (Postgres+pgvector, Redis, Redpanda)
	$(STACK) infra

down: ## Stop everything (keeps data volumes)
	$(STACK) down

logs: ## Tail web + api logs
	$(STACK) logs

stack: ## Build + run the FULL stack on Apple container (web :3000, api :8000, +Postgres/Redis). Host needs no local deps.
	$(STACK) up --build

stack-down: ## Stop the full stack (keeps data volumes)
	$(STACK) down

stack-logs: ## Tail web + api logs
	$(STACK) logs

nuke: ## Stop the stack and delete its volumes + locally-built images (reclaim every byte)
	$(STACK) nuke

fmt: ## Auto-format everything (Prettier + Ruff)
	bun run format
	cd $(API_DIR) && uv run ruff format . && uv run ruff check --fix .

fmt-check: ## Check formatting without writing
	bun run format:check

lint: ## Lint JS + Python
	bun run lint
	cd $(API_DIR) && uv run ruff check .

typecheck: ## Typecheck JS workspaces
	bun run typecheck

types: ## Generate FE API types from the FastAPI OpenAPI schema (single source of truth — never hand-edit api.ts)
	cd $(API_DIR) && uv run python -c "import json, app.main as m; print(json.dumps(m.app.openapi()))" > ../../packages/types/openapi.json
	bunx openapi-typescript packages/types/openapi.json -o packages/types/src/api.ts
	@echo "regenerated packages/types/src/api.ts — run 'make typecheck' to confirm FE/BE lockstep"

test: test-api ## Run all tests
	bun run test

test-api: ## Run API tests
	cd $(API_DIR) && uv run pytest -q

doctrine: ## Run the doctrine gates (license D2 + promotion D5 + ports D1 + doc alignment)
	python3 scripts/check_model_licenses.py
	python3 scripts/check_promotion.py
	python3 scripts/check_ports.py
	python3 scripts/check_doc_alignment.py

ci: fmt-check lint typecheck doctrine test ## Run the full local CI gate

data-export: ## Export the interactions spine into training examples + insight report (needs GYF_DATABASE_URL)
	cd ml && $(CACHE_ENV) uv run --extra postgres python -m pipelines.export_events

m2-bakeoff: ## Build + run the M2 encoder bake-off on Apple container (weights in a named volume; reports to host)
	container build -f ml/Dockerfile -t gyf-ml-bakeoff .
	mkdir -p eval-reports/bakeoffs
	container volume inspect gyf-hf-cache >/dev/null 2>&1 || container volume create gyf-hf-cache
	container run --rm \
	  -v gyf-hf-cache:/cache \
	  --mount "source=$(CURDIR)/data/e2e,target=/app/data/e2e,readonly" \
	  -v "$(CURDIR)/eval-reports/bakeoffs:/app/eval-reports/bakeoffs" \
	  gyf-ml-bakeoff

m2-clean: ## Delete the bake-off image and its model-weights volume (reclaim all space)
	-container image delete gyf-ml-bakeoff
	-container volume delete gyf-hf-cache

clean: ## Remove build artifacts and caches
	rm -rf app/.next .turbo $(API_DIR)/.pytest_cache
	find . -path ./node_modules -prune -o -name '__pycache__' -type d -print0 2>/dev/null | xargs -0 rm -rf
