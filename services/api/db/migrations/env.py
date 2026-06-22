"""Alembic environment for the GYF Postgres schema.

The database URL comes from the application settings (12-factor, env-driven via
``GYF_DATABASE_URL``) rather than alembic.ini, so migrations target the same
database the API uses. Migrations are authored as raw SQL (no ORM/autogenerate);
``schema.sql`` remains the human-readable snapshot of the baseline.
"""

from __future__ import annotations

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings

config = context.config

# The application uses psycopg (v3); pin SQLAlchemy to that driver explicitly so
# alembic doesn't fall back to the psycopg2 default for a bare ``postgresql://``
# URL (psycopg2 isn't a project dependency). psycopg3 covers alembic's sync use.
_db_url = settings.database_url
for _prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://", "postgresql://"):
    if _db_url.startswith(_prefix):
        _db_url = "postgresql+psycopg://" + _db_url[len(_prefix) :]
        break
config.set_main_option("sqlalchemy.url", _db_url)

# No ORM models — migrations are explicit SQL, so there is no target metadata.
target_metadata = None


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live connection (`alembic upgrade --sql`)."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
