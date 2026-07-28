"""ML platform configuration (12-factor, env-driven).

Mirrors services/api app.config: a single ``settings`` instance read from the
environment with a ``GYF_`` prefix, so the ML jobs and the API share the same
database URL and conventions.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from gyf_contracts.eval_report import RUNTIME_MODELS


_PRODUCTION_ENCODER = RUNTIME_MODELS["encoder"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GYF_", env_file=".env", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/gyf"

    # Perception model identity. The version string is written to
    # item_embeddings.model_version and items.attributes so backfill is idempotent
    # and every derived attribute is traceable to the model that produced it.
    perception_model: str = _PRODUCTION_ENCODER.model_uri
    perception_model_version: str = _PRODUCTION_ENCODER.model_version
    # "auto" picks the most powerful device available (CUDA > Intel XPU > CPU);
    # Apple MPS is never auto-selected. Set GYF_PERCEPTION_DEVICE explicitly
    # (e.g. "cpu") to override.
    perception_device: str = "auto"
    perception_batch_size: int = 16  # images encoded per GPU forward pass in backfill
    perception_io_workers: int = 8  # parallel image loaders feeding each batch

    # Free-tier GPU serving lane (D7). When set, perception encodes through a
    # remote HF ZeroGPU Space (see spaces/gyf-gpu) instead of loading weights
    # locally; unset = local SiglipEncoder baseline (invariant #5: a baseline
    # always sits behind the port). Example: "https://<user>-gyf-gpu.hf.space".
    encoder_remote_url: str = ""
    # Wire protocol of that lane: "gradio" (HF ZeroGPU Space), "http" (plain JSON,
    # e.g. the Modal CPU text lane that serves /items/search — F2.5), or "local_cpu"
    # (explicit always-on Render-compatible SigLIP2 CPU baseline). Same port either way;
    # see ml/serving/modal_encoder.py and docs/deploy/gpu-lane.md.
    encoder_remote_kind: str = "gradio"
    # Bearer token for the http lane (Modal proxy auth); unused by the gradio lane.
    encoder_remote_key: str = ""
    # HF token for private Spaces / higher ZeroGPU quota; passed to gradio_client.
    hf_token: str = ""


settings = Settings()
