# GYF developer tasks. Run `make` or `make help` for the list.
# Toolchain: Bun 1.1+ (JS workspaces), uv (Python/API), Docker (local infra).

.DEFAULT_GOAL := help
SHELL := bash
API_DIR := services/api

COMPOSE := docker compose -f infra/docker-compose.yml
# Build with the classic builder: this machine's ~/.docker/buildx/activity dir is locked by
# macOS ("operation not permitted"), which aborts BuildKit. Drop the env prefix once buildx is
# writable again (restart Docker Desktop, or grant the terminal Full Disk Access).
COMPOSE_BUILD := DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 $(COMPOSE)

.PHONY: help install check-uv migrate dev dev-web dev-api up down logs stack stack-down stack-logs nuke fmt fmt-check lint typecheck test test-api doctrine ci types m2-bakeoff m2-clean clean

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
	cd $(API_DIR) && uv run --extra postgres --extra migrate python -m alembic upgrade head

dev: check-uv ## Boot web + API together (Ctrl-C stops both)
	@echo "web → http://localhost:3000   api → http://localhost:8000"
	@trap 'kill 0' EXIT; \
		( cd $(API_DIR) && uv run uvicorn app.main:app --reload --port 8000 ) & \
		bun run dev & \
		wait

dev-web: ## Run only the web app
	bun run dev

dev-api: check-uv ## Run only the API service
	cd $(API_DIR) && uv run --extra postgres --extra migrate uvicorn app.main:app --reload --port 8000

up: ## Start local infra only (Postgres+pgvector, Redis, Redpanda)
	$(COMPOSE) up -d postgres redis redpanda

down: ## Stop everything (keeps data volumes)
	$(COMPOSE) down

logs: ## Tail infra logs
	$(COMPOSE) logs -f

stack: ## Build + run the FULL stack in Docker (web :3000, api :8000, +Postgres/Redis). Host needs no local deps.
	$(COMPOSE_BUILD) up -d --build web api
	@echo "web → http://localhost:3000   api → http://localhost:8000   (make stack-logs to tail)"

stack-down: ## Stop the full Docker stack (keeps data volumes)
	$(COMPOSE) down

stack-logs: ## Tail web + api logs
	$(COMPOSE) logs -f web api

nuke: ## Stop the stack and delete its volumes + locally-built images (reclaim every byte)
	$(COMPOSE) down -v --rmi local

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

doctrine: ## Run the doctrine gates (license D2 + promotion D5 + ports D1)
	python scripts/check_model_licenses.py
	python scripts/check_promotion.py
	python scripts/check_ports.py

ci: fmt-check lint typecheck doctrine test ## Run the full local CI gate

m2-bakeoff: ## Build + run the M2 encoder bake-off in Docker (weights in a named volume; reports to host)
	docker build -f ml/Dockerfile -t gyf-ml-bakeoff .
	mkdir -p eval-reports/bakeoffs
	docker run --rm \
	  -v gyf-hf-cache:/cache \
	  -v "$(CURDIR)/data/e2e:/app/data/e2e:ro" \
	  -v "$(CURDIR)/eval-reports/bakeoffs:/app/eval-reports/bakeoffs" \
	  gyf-ml-bakeoff

m2-clean: ## Delete the bake-off image and its model-weights volume (reclaim all Docker space)
	-docker rmi gyf-ml-bakeoff
	-docker volume rm gyf-hf-cache

clean: ## Remove build artifacts and caches
	rm -rf app/.next .turbo $(API_DIR)/.pytest_cache
	find . -path ./node_modules -prune -o -name '__pycache__' -type d -print0 2>/dev/null | xargs -0 rm -rf
