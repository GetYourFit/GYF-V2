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
        (self.root / "apps/expo/src/app").mkdir(parents=True)
        (self.root / ".github/workflows").mkdir(parents=True)
        self.write_fixture()

    def tearDown(self) -> None:
        shutil.rmtree(self.root)

    def write_fixture(self) -> None:
        (self.root / "apps/expo/app.json").write_text(
            json.dumps(
                {
                    "expo": {
                        "web": {"output": "server"},
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
        (self.root / "apps/expo/src/app/__deployment+api.ts").write_text(
            "export function GET() { return Response.json({ ok: true }); }\n", encoding="utf-8"
        )
        (self.root / ".github/workflows/cd.yml").write_text(
            "\n".join(
                [
                    "- run: node scripts/verify-deploy.mjs --api-url \"$EXPO_PUBLIC_API_URL\"",
                    "- run: node scripts/capture-deploy-record.mjs",
                    "- uses: actions/upload-artifact@v4",
                    "- run: cat deploy-records/rollback-record-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
                    "github.event.workflow_run.head_sha",
                    "checked_out_sha=$(git rev-parse HEAD)",
                    "latest_default_sha=$(git rev-parse FETCH_HEAD)",
                    "echo current $DEFAULT_BRANCH",
                    "echo \"CHECKED_OUT_SHA=$checked_out_sha\" >> \"$GITHUB_ENV\"",
                    "npm exec --yes eas-cli@21.4.0 -- deploy --prod",
                    "EXPO_TOKEN is not configured; refusing",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        (self.root / ".github/workflows/ci.yml").write_text(
            "- run: bun --cwd apps/expo run doctor\n", encoding="utf-8"
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

    def test_rejects_missing_server_output(self) -> None:
        config_path = self.root / "apps/expo/app.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        config["expo"]["web"]["output"] = "static"
        config_path.write_text(json.dumps(config), encoding="utf-8")

        self.assertIn(
            "apps/expo/app.json must use server web output for deployment-ID verification",
            check_expo_hosting.findings(self.root),
        )

    def test_rejects_missing_live_deploy_verification(self) -> None:
        (self.root / ".github/workflows/cd.yml").write_text("jobs: {}\n", encoding="utf-8")

        self.assertIn(
            "CD must verify the immutable EAS deployment after deployment",
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

    def test_rejects_missing_expo_doctor(self) -> None:
        (self.root / ".github/workflows/ci.yml").write_text("jobs: {}\n", encoding="utf-8")

        self.assertIn(
            "CI must run Expo Doctor against the checked-in SDK and native peer set",
            check_expo_hosting.findings(self.root),
        )


if __name__ == "__main__":
    unittest.main()
