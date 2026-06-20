# GYF developer tasks. Run `make` or `make help` for the list.
# Toolchain: Bun 1.1+ (JS workspaces), uv (Python/API), Docker (local infra).

.DEFAULT_GOAL := help
SHELL := bash
API_DIR := services/api

.PHONY: help install dev dev-web dev-api up down logs fmt fmt-check lint typecheck test test-api doctrine ci clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (JS workspaces + Python API)
	bun install
	cd $(API_DIR) && uv sync --extra dev --extra postgres

dev: ## Boot web + API together (Ctrl-C stops both)
	@echo "web → http://localhost:3000   api → http://localhost:8000"
	@trap 'kill 0' EXIT; \
		( cd $(API_DIR) && uv run uvicorn app.main:app --reload --port 8000 ) & \
		bun run dev & \
		wait

dev-web: ## Run only the web app
	bun run dev

dev-api: ## Run only the API service
	cd $(API_DIR) && uv run uvicorn app.main:app --reload --port 8000

up: ## Start local infra (Postgres+pgvector, Redis, Redpanda)
	docker compose -f infra/docker-compose.yml up -d

down: ## Stop local infra
	docker compose -f infra/docker-compose.yml down

logs: ## Tail local infra logs
	docker compose -f infra/docker-compose.yml logs -f

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

test: test-api ## Run all tests
	bun run test

test-api: ## Run API tests
	cd $(API_DIR) && uv run pytest -q

doctrine: ## Run the doctrine gates (license D2 + promotion D5 + ports D1)
	python scripts/check_model_licenses.py
	python scripts/check_promotion.py
	python scripts/check_ports.py

ci: fmt-check lint typecheck doctrine test ## Run the full local CI gate

clean: ## Remove build artifacts and caches
	rm -rf app/.next .turbo $(API_DIR)/.pytest_cache
	find . -path ./node_modules -prune -o -name '__pycache__' -type d -print0 2>/dev/null | xargs -0 rm -rf
