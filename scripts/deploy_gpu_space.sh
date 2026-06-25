#!/usr/bin/env bash
# Deploy the GYF GPU serving lane (spaces/gyf-gpu) to a Hugging Face Space.
#
# This is the remote ZeroGPU backend behind perception.remote.RemoteEncoder (doctrine D7):
# only the encoder forward pass runs on the Space; the catalog, retrieval scoring, ranking,
# and the M2 bake-off stay local. See docs/deploy/gpu-lane.md.
#
# Usage:
#   HF_TOKEN=hf_xxx HF_USER=<your-hf-username> bash scripts/deploy_gpu_space.sh
#
# Optional env:
#   SPACE_NAME   Space repo name (default: gyf-gpu)
#   HARDWARE     ZeroGPU SKU to request (default: zero-a10g; requires HF Pro). Set to
#                "cpu-basic" to deploy without GPU (free; slow — for wiring smoke tests only).
#
# Requires only `uv` on PATH (huggingface_hub runs via uvx — nothing is installed globally).
set -euo pipefail

: "${HF_TOKEN:?set HF_TOKEN to a Hugging Face token with write access (hf.co/settings/tokens)}"
: "${HF_USER:?set HF_USER to your Hugging Face username}"
SPACE_NAME="${SPACE_NAME:-gyf-gpu}"
HARDWARE="${HARDWARE:-zero-a10g}"
REPO_ID="${HF_USER}/${SPACE_NAME}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/spaces/gyf-gpu"

echo "[deploy] uploading ${SRC_DIR} -> space ${REPO_ID} (hardware: ${HARDWARE})"

HF_TOKEN="$HF_TOKEN" REPO_ID="$REPO_ID" HARDWARE="$HARDWARE" SRC_DIR="$SRC_DIR" \
  uvx --from huggingface_hub python - <<'PY'
import os
from huggingface_hub import HfApi

api = HfApi(token=os.environ["HF_TOKEN"])
repo_id = os.environ["REPO_ID"]
hardware = os.environ["HARDWARE"]
src = os.environ["SRC_DIR"]

# Create the Space (idempotent: exist_ok). Gradio SDK; request the chosen hardware.
api.create_repo(
    repo_id=repo_id,
    repo_type="space",
    space_sdk="gradio",
    space_hardware=hardware,
    exist_ok=True,
)
# Push app.py + requirements.txt + README.md (README frontmatter sets the Space config).
api.upload_folder(repo_id=repo_id, repo_type="space", folder_path=src)
print(f"[deploy] done -> https://huggingface.co/spaces/{repo_id}")
print(f"[deploy] endpoint URL: https://{repo_id.replace('/', '-')}.hf.space")
PY

echo
echo "[deploy] Wait for the Space to finish building (Space page shows 'Running'), then run the"
echo "[deploy] GPU bake-off — all three encoders, including the heavy so400m candidate:"
echo
echo "  cd ml && GYF_ENCODER_REMOTE_URL=https://${HF_USER}-${SPACE_NAME}.hf.space \\"
echo "      GYF_HF_TOKEN=\$HF_TOKEN uv run --extra perception --extra remote python -m eval.bake_off"
