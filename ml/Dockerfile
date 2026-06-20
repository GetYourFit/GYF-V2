# GYF ML — reproducible M2 encoder bake-off image.
#
# Self-contained and disposable: model weights download into HF_HOME=/cache, which is a Docker
# named volume (not the host filesystem), so `make m2-clean` reclaims every byte. The only thing
# written to the host is the small JSON reports, via a bind mount at run time.
#
# Build context is the repo root (for packages/contracts + models.registry.json); .dockerignore
# keeps it tiny. Target Python is 3.12 (the project standard), independent of any host venv.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV HF_HOME=/cache \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # CPU-only torch: the bake-off runs on CPU here, so we skip the multi-GB CUDA
    # wheels (smaller image, faster build, no GPU junk). uv selects CPU wheels.
    UV_TORCH_BACKEND=cpu \
    UV_HTTP_TIMEOUT=300

WORKDIR /app

# Shared contracts (path dependency of gyf-ml) + the ML source, in the layout ml/pyproject expects.
COPY packages/contracts /app/packages/contracts
COPY ml /app/ml
COPY models.registry.json /app/models.registry.json

# Resolve the perception runtime (CPU torch, open_clip, transformers) + gyf-ml into an in-image venv.
WORKDIR /app/ml
RUN uv sync --extra perception --no-dev

# Run unprivileged; /cache is the weights mountpoint and must be writable by the runner.
# NOTE: intentionally no `VOLUME ["/cache"]` — a declared VOLUME makes Docker auto-create an
# anonymous volume on every run that doesn't bind an explicit one, silently littering the host
# with dangling volumes. `make m2-bakeoff` mounts the named `gyf-hf-cache` for persistence and
# `make m2-clean` removes it; without VOLUME, a bare `docker run` leaves zero residue.
RUN useradd --create-home runner \
    && mkdir -p /cache /app/eval-reports/bakeoffs \
    && chown -R runner:runner /cache /app
USER runner

# Default command runs the bake-off with repo defaults; args pass through (e.g. --out, --images).
ENTRYPOINT ["uv", "run", "python", "-m", "eval.bake_off"]
