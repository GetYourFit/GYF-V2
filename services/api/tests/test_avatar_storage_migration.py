from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "db" / "migrations" / "versions" / "0023_avatar_storage.py"


def test_avatar_storage_migration_is_guarded_and_owner_scoped() -> None:
    sql = MIGRATION.read_text()
    assert "to_regclass('storage.buckets') IS NULL" in sql
    assert "file_size_limit" in sql
    assert "5242880" in sql
    for action in ("insert", "select", "update", "delete"):
        assert f"avatars_{action}_own" in sql
    assert "TO authenticated" in sql
    # Every policy scopes writes to the caller's own two slots. Five occurrences: insert CHECK,
    # select USING, update USING + CHECK, delete USING. A miscount means a policy lost its scope.
    assert sql.count("(SELECT auth.uid()::text) || '/avatar-a'") == 5
    assert sql.count("(SELECT auth.uid()::text) || '/avatar-b'") == 5
    assert "split_part(name" not in sql


def test_avatar_bucket_allows_every_picked_format_but_never_svg() -> None:
    """The client declares its own Content-Type into a public bucket.

    Expo web uploads the picked file's true type, so jpeg/png/webp must all be allowed or web
    picks fail. ``image/svg+xml`` must never join them: an SVG served from the Supabase origin
    under an attacker-declared type is a stored-XSS primitive, not an avatar.
    """
    sql = MIGRATION.read_text()
    assert "ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]" in sql
    # The quoted SQL literal, not the bare word — the migration's own comment explains the ban.
    assert "'image/svg" not in sql.lower()
