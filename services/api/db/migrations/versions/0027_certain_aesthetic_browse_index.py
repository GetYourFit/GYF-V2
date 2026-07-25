from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0027_certain_aesthetic_browse"
down_revision: str | None = "0026_recommendation_join_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_items_certain_aesthetic_browse"
_CREATE = (
    f"CREATE INDEX CONCURRENTLY {_INDEX} ON items "
    "(category, (attributes #>> '{perception,attributes,aesthetic,value}'), "
    "(price IS NOT NULL) DESC, id) "
    "WHERE available AND category <> 'unknown' "
    "AND jsonb_array_length(image_refs) > 0 "
    "AND attributes #>> '{perception,attributes,aesthetic,certain}' = 'true'"
)


def upgrade() -> None:
    context = op.get_context()
    with context.autocommit_block():
        if context.as_sql:
            op.execute(
                _CREATE.replace(
                    "CREATE INDEX CONCURRENTLY", "CREATE INDEX CONCURRENTLY IF NOT EXISTS", 1
                )
            )
            return
        valid = op.get_bind().scalar(
            text(
                "SELECT indisvalid FROM pg_catalog.pg_index "
                "WHERE indexrelid = to_regclass(:index_name)"
            ),
            {"index_name": _INDEX},
        )
        if valid is True:
            return
        if valid is False:
            op.execute(f"DROP INDEX CONCURRENTLY {_INDEX}")
        op.execute(_CREATE)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
