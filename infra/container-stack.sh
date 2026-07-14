#!/usr/bin/env bash
# GYF local stack on Apple `container` — the compose replacement.
#
# Apple `container` (1.0+) has no `docker compose`, so this script is the single
# idempotent orchestrator for the full local spine: Postgres+pgvector, Redis,
# Redpanda, the FastAPI service, and the Next.js web app. It mirrors
# infra/docker-compose.yml exactly — same images, env, ports, mounts, and boot
# order — but expresses the bits compose did declaratively (healthchecks +
# depends_on) as explicit health-wait loops, because `container run` has neither.
#
# Networking parity: every service runs on the default network and is named after
# its compose service (postgres/redis/api/web). With the system default
# DNS domain `gyf.test` (see ~/.config/container/config.toml), containers register
# as <name>.gyf.test and resolve each other by short name — so the API still reaches
# `postgres:5432`, `redis:6379` unchanged.
#
# Usage:  bash infra/container-stack.sh <up|down|nuke|status|logs> [args]
#   up [--build]   start the full stack (─-build rebuilds api+web images first)
#   down           stop+remove containers, keep data volumes
#   nuke           down + remove data volumes AND locally-built images
#   status         list stack containers
#   logs [svc]     tail logs (default: api+web; or one of the service names)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Images ───────────────────────────────────────────────────────────────────
PG_IMAGE="pgvector/pgvector:pg16"
REDIS_IMAGE="redis:7-alpine"
API_IMAGE="gyf-api"
WEB_IMAGE="gyf-web"

INFRA_SERVICES=(postgres redis)
APP_SERVICES=(api web)
ALL_SERVICES=(postgres redis api web)
VOLUMES=(gyf-pgdata gyf-web-root-modules gyf-web-app-modules gyf-web-next-cache)

# ── Small helpers ─────────────────────────────────────────────────────────────
log()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31mxx\033[0m %s\n' "$*" >&2; exit 1; }

exists()  { container inspect "$1" >/dev/null 2>&1; }
running() { container ls 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$1"; }
rm_one()  { container delete --force "$1" >/dev/null 2>&1 || true; }

ensure_system() {
  container ls >/dev/null 2>&1 || die "container apiserver is not reachable — run 'container system start' in your login Terminal first."
}

ensure_volumes() {
  for v in "${VOLUMES[@]}"; do
    container volume inspect "$v" >/dev/null 2>&1 || container volume create "$v" >/dev/null
  done
}

# Poll a readiness command until it succeeds (the compose healthcheck equivalent).
# Args: <human-name> <retries> <command...>
wait_until() {
  local name="$1" retries="$2"; shift 2
  local i
  for ((i = 1; i <= retries; i++)); do
    if "$@" >/dev/null 2>&1; then
      log "$name is ready"
      return 0
    fi
    sleep 2
  done
  die "$name did not become ready after $((retries * 2))s — check 'container logs $name'"
}

# (Re)create a detached container under a fixed name, replacing any prior instance
# so the script is fully idempotent.
run_svc() {
  local name="$1"; shift
  rm_one "$name"
  container run -d --name "$name" "$@" >/dev/null
}

# ── Service definitions ───────────────────────────────────────────────────────
start_postgres() {
  log "postgres (pgvector)"
  # Apple `container` volumes are ext4 block devices, so the mount root holds a
  # lost+found dir and initdb refuses it. Point PGDATA at a subdirectory (the
  # initdb-recommended pattern) so the data cluster lives cleanly under the mount.
  run_svc postgres \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gyf \
    -e PGDATA=/var/lib/postgresql/data/pgdata \
    -p 5432:5432 \
    -v gyf-pgdata:/var/lib/postgresql/data \
    "$PG_IMAGE"
  wait_until postgres 30 container exec postgres pg_isready -U postgres
}

start_redis() {
  log "redis"
  run_svc redis -p 6379:6379 "$REDIS_IMAGE"
  wait_until redis 30 container exec redis redis-cli ping
}

start_api() {
  log "api (FastAPI, migrates to head on boot)"
  # Source bind-mounted for hot reload; the venv lives at /opt/venv (outside /app)
  # so these mounts never shadow installed deps. The catalog images dir is mounted
  # read-only under /media's source path.
  run_svc api \
    -e GYF_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gyf \
    -e GYF_REDIS_URL=redis://redis:6379/0 \
    -e GYF_ENV=local \
    -e GYF_AUTH_DISABLED=true \
    -e GYF_EVENT_SINK=postgres \
    -e GYF_MEDIA_DIR=/app/services/api/data/e2e/images \
    -p 8000:8000 \
    -m 2g \
    -v "$ROOT/services/api:/app/services/api" \
    -v "$ROOT/packages/contracts:/app/packages/contracts" \
    --mount "source=$ROOT/data,target=/app/services/api/data,readonly" \
    "$API_IMAGE"
  wait_until api 60 sh -c "curl -fsS http://localhost:8000/health"
}

# Unlike Docker, Apple `container` does NOT seed a fresh volume from the image's
# content at the mount path — it masks it. So a node_modules volume mounted over
# the image's deps would be empty and break the app. Seed each module volume from
# the image once (idempotent: skipped if already populated).
seed_module_volume() {
  local vol="$1" src="$2" n
  n=$(container run --rm -v "$vol:/seed" "$WEB_IMAGE" sh -c 'ls -A /seed | grep -v "^lost+found$" | wc -l' 2>/dev/null | tr -d '[:space:]')
  if [ "${n:-0}" = "0" ]; then
    log "seeding $vol from image:$src"
    container run --rm -v "$vol:/seed" "$WEB_IMAGE" sh -c "cp -a $src/. /seed/"
  fi
}

start_web() {
  log "web (Next.js dev)"
  # Bind only source — node_modules + .next stay container-only (host darwin vs
  # container linux resolve different native binaries), masked by named volumes
  # that we seed from the image (see seed_module_volume).
  seed_module_volume gyf-web-root-modules /repo/node_modules
  seed_module_volume gyf-web-app-modules  /repo/app/node_modules
  run_svc web \
    -e NEXT_TELEMETRY_DISABLED=1 \
    -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
    -p 3000:3000 \
    -m 2g \
    -v "$ROOT/app:/repo/app" \
    -v "$ROOT/packages:/repo/packages" \
    -v gyf-web-root-modules:/repo/node_modules \
    -v gyf-web-app-modules:/repo/app/node_modules \
    -v gyf-web-next-cache:/repo/app/.next \
    "$WEB_IMAGE"
  wait_until web 90 sh -c "curl -fsS http://localhost:3000"
}

build_images() {
  log "building images (api, web) with the container builder"
  container builder start >/dev/null 2>&1 || true
  container build -f services/api/Dockerfile -t "$API_IMAGE" .
  container build -f app/Dockerfile -t "$WEB_IMAGE" .
  # The web module volumes cache the image's node_modules; a rebuild may change
  # deps, so drop them to force a fresh re-seed on the next start_web.
  for v in gyf-web-root-modules gyf-web-app-modules; do
    container volume delete "$v" >/dev/null 2>&1 || true
  done
}

# ── Top-level commands ────────────────────────────────────────────────────────
cmd_infra() {
  ensure_system
  ensure_volumes
  start_postgres
  start_redis
    echo
  log "infra up →  postgres :5432   redis :6379"
}

cmd_up() {
  ensure_system
  [ "${1:-}" = "--build" ] && build_images
  ensure_volumes
  start_postgres
  start_redis
    start_api   # depends_on postgres + redis (healthy) — guaranteed by the waits above
  start_web   # depends_on api
  echo
  log "stack up →  web http://localhost:3000   api http://localhost:8000"
  log "tail logs:  bash infra/container-stack.sh logs"
}

cmd_down() {
  ensure_system
  log "stopping stack (data volumes kept)"
  for s in "${ALL_SERVICES[@]}"; do rm_one "$s"; done
}

cmd_nuke() {
  ensure_system
  cmd_down
  log "removing data volumes + locally-built images"
  for v in "${VOLUMES[@]}"; do container volume delete "$v" >/dev/null 2>&1 || true; done
  container image delete "$API_IMAGE" "$WEB_IMAGE" >/dev/null 2>&1 || true
}

cmd_status() {
  ensure_system
  container ls -a 2>/dev/null | awk 'NR==1 || $1 ~ /^(postgres|redis|api|web)$/'
}

cmd_logs() {
  ensure_system
  local svc="${1:-}"
  if [ -n "$svc" ]; then
    exec container logs -f "$svc"
  fi
  # Default: multiplex api + web (the two services you watch during dev).
  trap 'kill 0' EXIT
  container logs -f api  | sed 's/^/[api] /' &
  container logs -f web  | sed 's/^/[web] /' &
  wait
}

case "${1:-}" in
  infra)  cmd_infra ;;
  up)     shift; cmd_up "$@" ;;
  down)   cmd_down ;;
  nuke)   cmd_nuke ;;
  status) cmd_status ;;
  logs)   shift; cmd_logs "$@" ;;
  *)      die "usage: $0 <infra|up [--build]|down|nuke|status|logs [service]>" ;;
esac
