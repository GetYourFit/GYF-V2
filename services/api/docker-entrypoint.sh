#!/usr/bin/env sh
# Container entrypoint: bring the schema to head, then run the given command.
#
# Alembic is the single source of truth for the schema (see db/migrations/) — the
# database is built from migrations alone, never from a side-loaded schema.sql. We
# migrate on every boot so a fresh volume (local stack) or a fresh deploy (Render)
# always lands at head before the app serves a request. `upgrade head` is a no-op
# once the DB is current, so repeated boots are safe.
#
# Single-instance, free-tier topology: migrating in the app entrypoint is correct
# here. When scaling to multiple replicas, split this into a dedicated migrate job
# (a one-shot init container / release phase) so replicas don't race.
set -e

echo "entrypoint: alembic upgrade head"
python -m alembic upgrade head

exec "$@"
