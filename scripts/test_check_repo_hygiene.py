from __future__ import annotations

from pathlib import Path
import unittest

import check_repo_hygiene as hygiene


class RepoHygieneTests(unittest.TestCase):
    def test_blocks_tracked_tooling_bin_even_when_small(self) -> None:
        findings = hygiene.find_findings(
            [".tooling/bin/uvx"],
            root=Path("/repo"),
            size_of=lambda _path: 8,
            read_bytes=lambda _path: b"#!/bin/sh\n",
        )

        self.assertEqual([finding.code for finding in findings], ["tracked-local-artifact"])
        self.assertIn(".tooling/bin/uvx", findings[0].render())

    def test_reports_large_binary_outside_cache_roots(self) -> None:
        findings = hygiene.find_findings(
            ["some/asset.bin"],
            root=Path("/repo"),
            size_of=lambda _path: hygiene.LARGE_BINARY_BYTES + 1,
            read_bytes=lambda _path: b"abc\0def",
        )

        self.assertEqual([finding.code for finding in findings], ["tracked-large-binary"])

    def test_allows_small_text_files(self) -> None:
        findings = hygiene.find_findings(
            ["docs/plans/gyf-launch-refactor-plan.md"],
            root=Path("/repo"),
            size_of=lambda _path: 1200,
            read_bytes=lambda _path: b"# docs\n",
        )

        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
