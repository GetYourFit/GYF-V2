from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import check_client_boundaries as boundaries


class ClientBoundaryTests(unittest.TestCase):
    def test_current_boundary_is_clean(self) -> None:
        self.assertEqual(boundaries.check(Path.cwd()), [])

    def test_rejects_expo_import_into_next_app(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "apps/expo/src/lib/unsafe.ts"
            source.parent.mkdir(parents=True)
            (root / "app/lib").mkdir(parents=True)
            (root / "app/lib/api.ts").write_text("export {}\n", encoding="utf-8")
            source.write_text('import "../../../../app/lib/api"\n', encoding="utf-8")
            self.assertTrue(any("retained Next app" in item for item in boundaries.check(root)))

    def test_rejects_framework_import_in_transport(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "packages/api-client/src/api.ts"
            source.parent.mkdir(parents=True)
            source.write_text('import "next/headers"\n', encoding="utf-8")
            self.assertTrue(any("framework dependency" in item for item in boundaries.check(root)))

    def test_allows_platform_fetch_and_shared_types(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "packages/api-client/src/api.ts"
            source.parent.mkdir(parents=True)
            source.write_text(
                'import type { Profile } from "@gyf/types";\n'
                'import { helper } from "./helper";\n'
                "void fetch;\n",
                encoding="utf-8",
            )
            (source.parent / "helper.ts").write_text("export const helper = 1;\n", encoding="utf-8")
            self.assertEqual(boundaries.transport_dependency_violations(root), [])


if __name__ == "__main__":
    unittest.main()
