from pathlib import Path


def test_catalogue_truth_migration_accepts_any_https_image_ref() -> None:
    source = (
        Path(__file__).resolve().parents[1]
        / "db"
        / "migrations"
        / "versions"
        / "0028_catalogue_truth_snapshot.py"
    ).read_text(encoding="utf-8")

    assert "jsonb_array_elements_text(image_refs)" in source
    assert "WHERE value ~ '^https://'" in source
