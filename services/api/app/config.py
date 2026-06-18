from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, 12-factor: read from environment."""

    model_config = SettingsConfigDict(env_prefix="GYF_", env_file=".env", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/gyf"
    redis_url: str = "redis://localhost:6379/0"
    event_broker_url: str = "localhost:9092"
    # Event sink backend: "local" (append-only JSONL) or "kafka" (Kafka/Redpanda).
    event_sink: str = "local"
    event_topic: str = "gyf.interactions"

    # --- Auth (Supabase-issued JWTs) ---
    # HS256 secret from the Supabase project (Settings → API → JWT Secret).
    # When empty in a non-local env, protected routes reject all requests.
    supabase_jwt_secret: str = ""
    jwt_audience: str = "authenticated"
    # Local dev convenience: when true, missing/invalid tokens resolve to a dev
    # principal so the service runs with no auth provider wired. Never enable in prod.
    auth_disabled: bool = False
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"

    @property
    def auth_is_open(self) -> bool:
        """Auth bypass is allowed only in local dev (explicit flag or no secret)."""
        return self.auth_disabled or (self.env == "local" and not self.supabase_jwt_secret)


settings = Settings()
