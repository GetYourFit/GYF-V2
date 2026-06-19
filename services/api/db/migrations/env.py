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
config.set_main_option("sqlalchemy.url", settings.database_url)

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
