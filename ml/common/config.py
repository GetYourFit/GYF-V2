"""ML platform configuration (12-factor, env-driven).

Mirrors services/api app.config: a single ``settings`` instance read from the
environment with a ``GYF_`` prefix, so the ML jobs and the API share the same
database URL and conventions.
"""

from pydantic import Field
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
    perception_batch_size: int = Field(
        16, ge=1, le=64
    )  # images encoded per forward pass in backfill
    perception_io_workers: int = Field(8, ge=1, le=32)  # parallel image loaders feeding each batch
    # CPU inference is explicitly bounded for Render-compatible local experiments. The
    # model's measured cold RSS is recorded in the local-lane evidence; if a container
    # advertises less memory, the encoder refuses to load and the API uses lexical search.
    perception_cpu_threads: int = Field(2, ge=1, le=8)
    perception_min_memory_bytes: int = Field(4_000_000_000, ge=0, le=64_000_000_000)

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
