from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import check_production_surfaces as guard


class ProductionSurfaceGuardTests(unittest.TestCase):
    def test_source_gate_is_green(self):
        self.assertEqual(guard.source_failures(guard.ROOT), [])

    def test_artifact_rejects_fixture_markers(self):
        with tempfile.TemporaryDirectory() as directory:
            dist = Path(directory)
            (dist / "index.html").write_text("fixture-recommendation-01", encoding="utf-8")
            self.assertTrue(guard.artifact_failures(dist))

    def test_artifact_accepts_product_only_export(self):
        with tempfile.TemporaryDirectory() as directory:
            dist = Path(directory)
            (dist / "index.html").write_text("GYF", encoding="utf-8")
            self.assertEqual(guard.artifact_failures(dist), [])


if __name__ == "__main__":
    unittest.main()
