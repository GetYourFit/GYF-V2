"""Durable, versioned truth snapshots for the searchable catalogue.

Refresh happens only after a completed ingest.  A failed refresh leaves the last
committed row intact, so callers receive the last known-good truth rather than a
fabricated empty catalogue.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from ..config import settings
from .retrieval import _GENDER_BUCKETS, _GENDER_FILTER, SEARCHABLE_ITEM_PREDICATE

_SNAPSHOT_ID = 1


@dataclass(frozen=True)
class CatalogueSnapshot:
    catalogue_version: int
    generated_at: datetime
    last_successful_ingest_at: datetime | None
    scopes: dict[str, dict[str, Any]]

    def facets(self, region: str | None) -> dict[str, Any] | None:
        if not region:
            return self.scopes.get("all")
        return self.scopes.get(region) or self.scopes.get("__global__")


class PostgresCatalogueSnapshotRepository:
    """One durable snapshot row; intentionally no request-time image fetching."""

    def __init__(self, pool: object) -> None:
        self._pool = pool

    def current(self) -> CatalogueSnapshot | None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(
                """SELECT catalogue_version, generated_at, last_successful_ingest_at, payload
                   FROM catalogue_truth_snapshots WHERE id = %s""",
                (_SNAPSHOT_ID,),
            ).fetchone()
        if row is None:
            return None
        return CatalogueSnapshot(
            catalogue_version=int(row[0]),
            generated_at=row[1],
            last_successful_ingest_at=row[2],
            scopes=row[3] if isinstance(row[3], dict) else json.loads(row[3]),
        )

    def refresh(self) -> CatalogueSnapshot:
        """Atomically replace the snapshot only after every aggregate succeeds."""
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            regions = [
                row[0]
                for row in conn.execute(
                    """SELECT DISTINCT region
                       FROM items CROSS JOIN LATERAL unnest(region_tags) AS region
                       WHERE region <> '' ORDER BY region"""
                )
            ]
            scopes = {"all": self._scope(conn, None), "__global__": self._scope(conn, "__global__")}
            scopes.update({region: self._scope(conn, region) for region in regions})
            row = conn.execute(
                """
                INSERT INTO catalogue_truth_snapshots
                    (id, catalogue_version, generated_at, last_successful_ingest_at, payload)
                VALUES (
                    %s, 1, now(), (SELECT max(last_seen_at) FROM items WHERE available), %s::jsonb
                )
                ON CONFLICT (id) DO UPDATE SET
                    catalogue_version = catalogue_truth_snapshots.catalogue_version + 1,
                    generated_at = EXCLUDED.generated_at,
                    last_successful_ingest_at = EXCLUDED.last_successful_ingest_at,
                    payload = EXCLUDED.payload
                RETURNING catalogue_version, generated_at, last_successful_ingest_at, payload
                """,
                (_SNAPSHOT_ID, json.dumps(scopes)),
            ).fetchone()
        return CatalogueSnapshot(int(row[0]), row[1], row[2], row[3])

    def _scope(self, conn: object, region: str | None) -> dict[str, Any]:
        where = SEARCHABLE_ITEM_PREDICATE
        params: list[object] = []
        if region == "__global__":
            where += " AND i.region_tags = '{}'"
        elif region:
            where += " AND (i.region_tags = '{}' OR i.region_tags @> ARRAY[%s]::text[])"
            params.append(region)

        def aggregate(group: str) -> dict[str, int]:
            rows = conn.execute(  # type: ignore[attr-defined]
                f"""SELECT {group}, COUNT(*) FROM item_embeddings e JOIN items i ON i.id = e.item_id
                    WHERE {where} GROUP BY {group}""",
                tuple(params),
            )
            return {str(key): int(count) for key, count in rows}

        def totals(extra_where: str, extra_params: list[object]) -> dict[str, Any]:
            row = conn.execute(  # type: ignore[attr-defined]
                f"""SELECT COUNT(*), COUNT(i.price), MIN(i.price), MAX(i.price)
                    FROM item_embeddings e JOIN items i ON i.id = e.item_id
                    WHERE {where} {extra_where}""",
                tuple(params) + tuple(extra_params),
            ).fetchone()
            return {
                "total": int(row[0]),
                "priced": int(row[1]),
                "price_min": float(row[2]) if row[2] is not None else None,
                "price_max": float(row[3]) if row[3] is not None else None,
            }

        by_gender = {
            bucket_name: totals(_GENDER_FILTER, [sorted(genders)])
            for genders, bucket_name in _GENDER_BUCKETS.items()
        }

        return {
            **totals("", []),
            "by_category": aggregate("i.category"),
            "by_audience": aggregate("COALESCE(i.attributes #>> '{taxonomy,audience}', 'adult')"),
            "by_source": aggregate("i.source_provider"),
            "by_image_status": aggregate("COALESCE(i.attributes #>> '{image,status}', 'usable')"),
            "by_gender": by_gender,
        }


def snapshot_freshness(snapshot: CatalogueSnapshot) -> tuple[int, str]:
    age = max(0, int((datetime.now(UTC) - snapshot.generated_at).total_seconds()))
    return age, "fresh" if age <= settings.catalogue_snapshot_fresh_seconds else "stale"
