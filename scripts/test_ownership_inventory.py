from __future__ import annotations

from pathlib import Path
import unittest

import ownership_inventory as inventory


class OwnershipInventoryTests(unittest.TestCase):
    def test_baseline_accepts_current_protected_paths_and_rejects_expansion(self) -> None:
        files = inventory.tracked_files(Path.cwd())
        self.assertEqual(inventory.baseline_violations(files), [])
        violations = inventory.baseline_violations([*files, "gyf_app/lib/new_reference.dart"])
        self.assertTrue(any("flutter-reference-client" in violation for violation in violations))

    def test_production_reference_to_frozen_surface_is_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text('import "../../../gyf_app/lib/main.dart"\n', encoding="utf-8")
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("gyf_app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_production_import_of_next_rollback_is_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text('import "../../../app/lib/api"\n', encoding="utf-8")
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_dynamic_import_and_require_of_next_rollback_are_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text(
                '\n'.join(
                    [
                        'await import("../../../app/lib/api")',
                        'const page = require("../../../app/lib/page")',
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_template_literal_import_and_require_of_next_rollback_are_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text(
                "\n".join(
                    [
                        "await import(`../../../app/lib/api`)",
                        "const page = require(`../../../app/lib/page`)",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_re_export_of_next_rollback_is_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text(
                '\n'.join(
                    [
                        'export * from "../../../app/lib/api"',
                        'export { client } from "../../../app/lib/client"',
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_namespace_re_export_of_next_rollback_is_rejected(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            source = root / "apps/expo/src/unsafe.ts"
            source.parent.mkdir(parents=True)
            source.write_text(
                'export * as api from "../../../app/lib/api"\n',
                encoding="utf-8",
            )
            violations = inventory.production_import_violations(root, ["apps/expo/src/unsafe.ts"])
            self.assertEqual(len(violations), 1)
            self.assertIn("app/", violations[0])
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_cannot_claim_next_rollback(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text("working-directory: app\n", encoding="utf-8")
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses working-directory app"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_normalizes_app_working_directory_variants(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text(
                "working-directory: ./app/\nworking-directory: apps/expo\n",
                encoding="utf-8",
            )
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses working-directory app"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_normalizes_quoted_app_working_directory_variants(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text(
                'working-directory: "./app/"\nworking-directory: \'app\'\n',
                encoding="utf-8",
            )
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses working-directory app"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_rejects_expression_working_directory_variants(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text(
                "working-directory: ${{ 'app' }}\n",
                encoding="utf-8",
            )
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses dynamic working-directory"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_rejects_multiline_working_directory_variants(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text(
                "working-directory: >-\n  app\n",
                encoding="utf-8",
            )
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses multiline working-directory"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)

    def test_deploy_configuration_rejects_indented_block_scalar_variants(self) -> None:
        root = Path(self._testMethodName)
        root.mkdir()
        try:
            workflow = root / ".github/workflows/cd.yml"
            workflow.parent.mkdir(parents=True)
            workflow.write_text(
                "working-directory: |2\n  app\n",
                encoding="utf-8",
            )
            render = root / "render.yaml"
            render.write_text("services: []\n", encoding="utf-8")
            violations = inventory.deployment_violations(root)
            self.assertEqual(
                violations,
                [
                    "deploy ownership violation: .github/workflows/cd.yml uses multiline working-directory"
                ],
            )
        finally:
            import shutil

            shutil.rmtree(root)


if __name__ == "__main__":
    unittest.main()
