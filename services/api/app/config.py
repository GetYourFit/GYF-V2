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

    # Directory of catalog images, served read-only under ``/media`` so API
    # responses can hand clients fetchable image URLs. Defaults to the local-dev
    # seed location (scripts/e2e_workstream_a.sh). Unset/missing dir = no media mount.
    media_dir: str = "data/e2e/images"

    # Public base URL for catalog images. When set (e.g. a Supabase Storage public
    # bucket: "https://<ref>.supabase.co/storage/v1/object/public/catalog"),
    # image_url points there. Empty = serve locally from the "/media" mount.
    media_base_url: str = ""

    # --- CORS ---
    # Comma-separated browser origins allowed to call the API (the deployed web
    # app, e.g. "https://gyf.vercel.app"). Empty = no cross-origin browser access
    # (same-origin only) — the safe default for local same-host dev.
    allowed_origins: str = ""

    # --- Auth (Supabase-issued JWTs) ---
    # Supabase projects sign access tokens with an asymmetric ES256 key (the modern
    # default): we verify against the project's public JWKS, derived from this URL
    # (e.g. "https://<ref>.supabase.co"). Preferred over the shared secret.
    supabase_url: str = ""
    # Legacy HS256 fallback: the shared secret from older projects (Settings → API →
    # JWT Secret). Used only when a token is HS256-signed. Asymmetric ES256 tokens
    # are verified via the JWKS instead and need no secret.
    supabase_jwt_secret: str = ""
    jwt_audience: str = "authenticated"
    # Local dev convenience: when true, missing/invalid tokens resolve to a dev
    # principal so the service runs with no auth provider wired. Never enable in prod.
    auth_disabled: bool = False
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"

    # --- Account lifecycle (P1-B) ---
    # Right-to-erasure is a two-step soft delete: DELETE /account tombstones the
    # user (sets users.deleted_at) and disables the account immediately; a purge
    # job hard-deletes (cascading) once the account has been tombstoned for at
    # least this many days, leaving a recovery window before data is irreversible.
    account_deletion_grace_days: int = 30

    # --- Observability (P0-E). All env-driven; unset = no-op (free-tier first). ---
    service_name: str = "gyf-api"
    # OTLP traces endpoint (e.g. http://localhost:4318). Unset = tracing disabled.
    otel_exporter_otlp_endpoint: str = ""
    # Sentry DSN for error reporting. Unset = Sentry disabled.
    sentry_dsn: str = ""
    # Fraction of transactions traced/sampled (0.0–1.0).
    trace_sample_rate: float = 1.0

    @property
    def cors_origins(self) -> list[str]:
        """Allowed browser origins, parsed from the comma-separated setting.

        In local dev the web (:3000) and API (:8000) are different origins, so the
        browser needs them explicitly allowed; we default them in so `make dev` works
        out of the box. Other envs stay locked to the configured origins only.
        """
        configured = [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if self.env == "local":
            local_dev = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
            return list(dict.fromkeys(configured + local_dev))
        return configured

    @property
    def jwks_url(self) -> str:
        """The Supabase project's public JWKS endpoint (for ES256 verification)."""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def auth_is_open(self) -> bool:
        """Auth bypass is allowed only in local dev with no auth provider wired.

        Wiring either the JWKS source (``supabase_url``) or the legacy HS256 secret
        turns verification on, even in local — so a configured project is enforced.
        """
        if self.auth_disabled:
            return True
        configured = bool(self.supabase_url) or bool(self.supabase_jwt_secret)
        return self.env == "local" and not configured


settings = Settings()
