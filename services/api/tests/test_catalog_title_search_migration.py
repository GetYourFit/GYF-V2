from pathlib import Path


MIGRATION = (
    Path(__file__).parents[1]
    / "db"
    / "migrations"
    / "versions"
    / "0022_catalog_title_search_index.py"
)


def test_catalog_title_search_index_matches_the_runtime_query_contract() -> None:
    source = MIGRATION.read_text()
    assert 'down_revision: str | None = "0021_catalog_image_count_index"' in source
    assert "CREATE INDEX CONCURRENTLY" in source
    assert "USING GIN" in source
    assert "to_tsvector('simple'::regconfig, title)" in source
    assert "WHERE available AND category <> 'unknown'" in source
    assert "jsonb_array_length(image_refs) > 0" in source
    assert "indisvalid" in source  # interrupted concurrent builds are repaired
