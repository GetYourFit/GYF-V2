"""ML platform configuration (12-factor, env-driven).

Mirrors services/api app.config: a single ``settings`` instance read from the
environment with a ``GYF_`` prefix, so the ML jobs and the API share the same
database URL and conventions.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GYF_", env_file=".env", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/gyf"

    # Perception model identity. The version string is written to
    # item_embeddings.model_version and items.attributes so backfill is idempotent
    # and every derived attribute is traceable to the model that produced it.
    perception_model: str = "hf-hub:Marqo/marqo-fashionSigLIP"
    perception_model_version: str = "marqo-fashionSigLIP-v1"
    perception_device: str = "cpu"  # beta runs on CPU; ZeroGPU/Modal later


settings = Settings()
