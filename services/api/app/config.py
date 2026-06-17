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


settings = Settings()
