# GYF API — dev image (FastAPI + uvicorn --reload).
#
# Goal: the host stays disposable. All Python deps live inside this image (target 3.12,
# independent of any host venv), so you can `rm -rf` the working tree and rebuild from git.
# Source is bind-mounted at run time (see infra/docker-compose.yml) for hot reload; nothing
# is written back to the host except what the app itself persists to Postgres/volumes.
#
# Build context is the repo root — the API has an editable path dependency on
# packages/contracts. .dockerignore keeps the context tiny.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/opt/venv/bin:$PATH

WORKDIR /app

# Shared contracts + the ml package (editable path deps) resolved first so dependency
# layers cache well. gyf-ml is needed by the photo-remote extra (ZeroGPU onboarding
# lane); only its light base deps install here — no research body runtime or model weights.
COPY packages/contracts /app/packages/contracts
COPY ml /app/ml
COPY services/api/pyproject.toml /app/services/api/pyproject.toml

# Resolve the runtime (postgres + dev + migrate + photo-remote extras) into /opt/venv —
# kept outside /app so a bind-mount over /app/services/api at run time never shadows it.
WORKDIR /app/services/api
RUN uv sync --extra dev --extra postgres --extra migrate --extra photo-remote --extra sentry --no-install-project

# App source is COPYed for standalone runs and overlaid by a bind mount in dev compose.
COPY services/api /app/services/api
COPY models.registry.json /app/models.registry.json
COPY eval-reports /app/eval-reports

# Bring the schema to head on boot (Alembic is the single source of truth), then run
# the CMD. /opt/venv is on PATH, so the entrypoint's `python -m alembic` resolves here.
ENTRYPOINT ["/app/services/api/docker-entrypoint.sh"]

EXPOSE 8000
# In-container env points at the compose service names, not localhost.
ENV GYF_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gyf \
    GYF_REDIS_URL=redis://redis:6379/0 \
    GYF_EVENT_BROKER_URL=redpanda:9092 \
    GYF_ENV=local \
    GYF_AUTH_DISABLED=true \
    GYF_EVENT_SINK=postgres

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
