from pydantic import field_validator, model_validator
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
    # Optional regex for browser origins (e.g. r"https://.*\.vercel\.app" to allow all
    # preview deploys). Applied alongside the exact list above. Empty = no regex match.
    allowed_origin_regex: str = ""

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

    # --- Photo onboarding (P1-B Cycles 2 & 3) ---
    # Max accepted upload size for POST /profile/photo (bytes); larger is rejected
    # before decode so an oversized image can't exhaust memory. Default 10 MiB.
    max_photo_bytes: int = 10 * 1024 * 1024
    # Body-type GPU lane (M3, doctrine D7). When set, the body-type module runs the
    # BiRefNet silhouette + RTMW keypoint pipeline on a remote HF ZeroGPU Space (see
    # spaces/gyf-gpu) instead of needing those models / a GPU on the API host; the
    # widths→ratios→silhouette taxonomy still runs here. Unset = local CPU-capable
    # SilhouetteBodyEstimator baseline (invariant #5).
    body_remote_url: str = ""
    # Skin-tone GPU lane (M4, doctrine D7). When set, the CIELAB→MST pipeline runs on
    # the ZeroGPU Space (the API host needs no pyfacer/torch); unset = local in-process.
    skintone_remote_url: str = ""
    # HF token for the gated SAM checkpoint / higher ZeroGPU quota; passed to gradio_client.
    hf_token: str = ""
    # ⚠ Fairness gate (engineering-doctrine D5/D6): the skin-tone module is surfaced
    # in BETA as an explicitly editable, honest-confidence ESTIMATE — never an
    # authority. It lands in onboarding as a pre-filled, user-correctable field
    # ("we estimated this — fix if wrong") and never overwrites a manual value.
    # RE-SHADOWED 2026-07-05: the only fairness report
    # (ml/eval-reports/skintone-fairness-mste-v1.json) fails the gate hard
    # (max_band_gap 3.2 vs ≤ 1.0, per-band MAE up to 5.4/10 buckets) AND the
    # photo-derived tone now feeds RANKING (recsys conditioning, ce61dac) — a
    # near-random estimate must not steer picks or inflate confidence
    # (invariants #1/#3). Flip via GYF_SKIN_TONE_ENABLED=true only after the
    # full-MST fairness eval passes. Manual skin tone is unaffected.
    skin_tone_enabled: bool = False

    @field_validator("body_remote_url", "skintone_remote_url", mode="after")
    @classmethod
    def _normalise_space_ref(cls, value: str) -> str:
        """Drop an implausible Space reference (e.g. a stray ``GYF_BODY_REMOTE_URL=true``).

        A valid ref is an http(s) URL or an ``owner/repo`` Space id. Anything else is
        treated as unset so a misconfigured env var abstains instantly instead of
        hanging ~10s on a 404 ``gradio_client`` Space lookup on every photo upload.
        """
        candidate = value.strip()
        if not candidate:
            return ""
        if candidate.startswith(("http://", "https://")):
            return candidate
        # "owner/repo" form: exactly one slash with non-empty halves and no whitespace.
        if candidate.count("/") == 1 and " " not in candidate and all(candidate.split("/")):
            return candidate
        return ""

    # --- Affiliate attribution (Cuelinks lane behind the AffiliateLinker port) ---
    # Cuelinks channel id (the `cid=` value in any deeplink the dashboard/API
    # generates). Unset = null linker: buy links pass through unwrapped.
    cuelinks_cid: str = ""
    # Cuelinks publisher API token (My Account → API). Used by the conversions
    # sync (transactions → purchase signal), not by link wrapping. Secret.
    cuelinks_api_token: str = ""

    # --- Virtual try-on (M9, doctrine D2: licensed model at inference) ---
    # Rendering lane provider: "fashn" | "fal-kolors" (licensed lanes) or ""
    # (unset = the NullTryOnRenderer baseline abstains honestly; the surface
    # still works).
    tryon_provider: str = ""
    # FASHN API key (fashn.ai → Settings → API). Secret; never committed.
    fashn_api_key: str = ""
    # fal.ai API key (fal.ai dashboard → Keys) for the Kling Kolors lane. Secret.
    fal_api_key: str = ""
    # Vendor quality mode: "performance" (~5s/garment) | "balanced" (~8s) |
    # "quality" (~15s). Cost is identical (1 credit/image) — this trades latency.
    tryon_mode: str = "balanced"

    # --- Observability (P0-E). All env-driven; unset = no-op (free-tier first). ---
    service_name: str = "gyf-api"
    # OTLP traces endpoint (e.g. http://localhost:4318). Unset = tracing disabled.
    otel_exporter_otlp_endpoint: str = ""
    # Sentry DSN for error reporting. Unset = Sentry disabled.
    sentry_dsn: str = ""
    # Fraction of transactions traced/sampled (0.0–1.0).
    trace_sample_rate: float = 1.0

    # --- Rate limiting (W1, security H-3). In-process fixed-window limiter keyed by
    # client (authenticated user when present, else IP) + route. Defaults are generous
    # so normal use never trips; they exist to blunt abuse — GPU-cost exhaustion on
    # photo onboarding, taste-model poisoning via feedback-stuffing, request floods.
    # NOTE (W7): the in-process counter is per-replica; a multi-replica deploy needs a
    # shared Redis backend for a global limit. Tracked, not silently shipped. ---
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = 60
    # Comma-separated IPs of trusted reverse proxies (the ingress/load balancer). Only
    # when the immediate TCP peer is in this set do we trust its X-Forwarded-For to
    # identify the real client; otherwise a client could spoof XFF to cycle identities
    # and bypass the limit entirely. Empty (default) = never trust XFF, key on the peer.
    trusted_proxies: str = ""
    # Per-window request caps per client. 0 disables the limit for that route.
    rate_limit_photo: int = 5
    # Try-on renders cost real vendor credits per image — keep the cap tight.
    rate_limit_tryon: int = 3
    rate_limit_recommend: int = 60
    rate_limit_feedback: int = 60
    rate_limit_search: int = 60
    rate_limit_support: int = 5
    rate_limit_default: int = 120

    @property
    def cors_origins(self) -> list[str]:
        """Allowed browser origins, parsed from the comma-separated setting.

        In local dev the web (:3000) and API (:8000) are different origins, so the
        browser needs them explicitly allowed; we default them in so `make dev` works
        out of the box. Other envs stay locked to the configured origins only.

        A trailing slash is stripped from each entry: browsers send the Origin header
        with no path (``https://app.example.com``), so a configured value with a
        trailing slash would silently never match — the single most common CORS
        misconfiguration. We normalize it away so that mistake can't break preflight.
        """
        configured = [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]
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
            # Hard guard: an auth bypass must never be reachable outside local dev.
            # Turn a misconfiguration into a startup-time failure, not a silent hole.
            if self.env != "local":
                raise RuntimeError(
                    "GYF_AUTH_DISABLED must not be set outside the local environment"
                )
            return True
        configured = bool(self.supabase_url) or bool(self.supabase_jwt_secret)
        return self.env == "local" and not configured

    @property
    def trusted_proxy_set(self) -> frozenset[str]:
        """Peer IPs whose X-Forwarded-For we trust (the ingress/LB)."""
        return frozenset(p.strip() for p in self.trusted_proxies.split(",") if p.strip())

    @model_validator(mode="after")
    def _fail_fast_on_unsafe_auth(self) -> "Settings":
        """Refuse to construct (→ process won't start) if the auth bypass is set
        outside local. A misconfiguration becomes an unmissable startup crash rather
        than silent 500s or, worse, an open door on a live deployment."""
        if self.auth_disabled and self.env != "local":
            raise ValueError("GYF_AUTH_DISABLED must not be set outside the local environment")
        return self

    @model_validator(mode="after")
    def _anchor_cors_in_production(self) -> "Settings":
        """Refuse to start in production with no browser origin configured (L-3).

        Outside local dev the web app is a different origin than the API, so an
        empty ``GYF_ALLOWED_ORIGINS`` means every browser request is blocked by
        CORS — the kind of silent misconfiguration that invites a panicked,
        over-permissive ``*`` fix in prod. Anchoring it here turns the mistake
        into an unmissable startup crash and documents that the value is required.
        ``allowed_origin_regex`` alone also satisfies the anchor (preview deploys).
        """
        if self.env != "local" and not (self.cors_origins or self.allowed_origin_regex.strip()):
            raise ValueError(
                "GYF_ALLOWED_ORIGINS (or GYF_ALLOWED_ORIGIN_REGEX) must be set outside "
                "the local environment so the browser can reach the API"
            )
        return self


settings = Settings()
