from __future__ import annotations

import json
from pathlib import Path
import shutil
import unittest

import check_expo_hosting


class ExpoHostingGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(self._testMethodName)
        (self.root / "apps/expo").mkdir(parents=True)
        (self.root / ".github/workflows").mkdir(parents=True)
        self.write_fixture()

    def tearDown(self) -> None:
        shutil.rmtree(self.root)

    def write_fixture(self) -> None:
        (self.root / "apps/expo/app.json").write_text(
            json.dumps(
                {
                    "expo": {
                        "plugins": [
                            [
                                "expo-router",
                                {"headers": dict(check_expo_hosting.REQUIRED_HEADERS)},
                            ]
                        ]
                    }
                }
            ),
            encoding="utf-8",
        )
        (self.root / "apps/expo/package.json").write_text(
            json.dumps({"dependencies": {"expo-server": "~57.0.1"}}), encoding="utf-8"
        )
        (self.root / ".github/workflows/cd.yml").write_text(
            "\n".join(
                [
                    "- run: node scripts/verify-deploy.mjs",
                    "- run: node scripts/capture-deploy-record.mjs",
                    "- uses: actions/upload-artifact@v4",
                    "- run: cat deploy-records/rollback-record-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    def test_accepts_complete_hosting_boundary(self) -> None:
        self.assertEqual(check_expo_hosting.findings(self.root), [])

    def test_rejects_missing_required_header(self) -> None:
        config_path = self.root / "apps/expo/app.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        del config["expo"]["plugins"][0][1]["headers"]["X-Frame-Options"]
        config_path.write_text(json.dumps(config), encoding="utf-8")

        self.assertIn(
            "Expo Hosting header X-Frame-Options must equal 'DENY'",
            check_expo_hosting.findings(self.root),
        )

    def test_rejects_missing_live_deploy_verification(self) -> None:
        (self.root / ".github/workflows/cd.yml").write_text("jobs: {}\n", encoding="utf-8")

        self.assertIn(
            "CD must verify the live EAS production alias after deployment",
            check_expo_hosting.findings(self.root),
        )

    def test_rejects_missing_rollback_record_publication(self) -> None:
        (self.root / ".github/workflows/cd.yml").write_text(
            "- run: node scripts/verify-deploy.mjs\n", encoding="utf-8"
        )

        self.assertIn(
            "CD must persist the immutable Expo rollback record after deployment",
            check_expo_hosting.findings(self.root),
        )


if __name__ == "__main__":
    unittest.main()
