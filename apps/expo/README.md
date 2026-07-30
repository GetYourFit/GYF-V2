# GYF Expo client

This is the SDK-pinned Expo Router client for the migration. It reuses the existing typed API
contract and stores native Supabase sessions in SecureStore. The existing Next.js client remains
the rollback/oracle surface until route parity and production cutover gates pass.

## Run

```bash
bun install
cp apps/expo/.env.example apps/expo/.env.local
bun --cwd apps/expo start --clear
```

Try Expo Go first. Set `EXPO_PUBLIC_API_URL` to point at the API; it is public configuration,
not a secret. Copy `.env.example` to `.env.local` and fill in the Supabase public values.
When unset, the client uses `http://localhost:8000`; this is safe only when a local API is running.
Physical-device users must set a reachable HTTPS API override; loopback HTTP is only for a
simulator or web client sharing the API host. Clear Metro after changing `.env.local`; cached
bundles keep their previous inlined values.
Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for auth. Native sessions use
SecureStore; web uses browser session storage. Never put service-role keys or access tokens in
`EXPO_PUBLIC_*` values.

SDK 57.0.9, React Native 0.86.2, and the new architecture are pinned in `package.json` and
`app.json`. The route directory contains routes only; components and utilities live under `src`.

## Live surfaces

The signed-in `Stylist` tab calls `/outfits/recommend` and records save/skip feedback against the
returned recommendation. When a user requests the next look, it also sends the displayed item IDs
so the API avoids repeating the same non-footwear category family when the catalogue offers an
alternative. `Explore` waits for the authenticated profile audience before its first catalogue
request: signed-in users see accessible loading, needs-profile, or retryable audience-error states
instead of a temporary ungendered grid. Anonymous and explicitly unknown audiences still widen
under the server's existing null-gender policy. Once the audience is ready, `Explore` calls
`/items/browse` for the default catalogue page and switches to `/items/search` whenever a query,
slot, sort, or maximum-price filter is active. Browse still ignores those explicit search filters,
but it is no longer generic for signed-in users: the API now conditions the default page on the
stated profile facts it already has, including gender slice, budget ceiling, skin tone, undertone,
body type, and style intent, while preserving behaviour-learned taste when present. Anonymous users
and signed-in users without profile facts still get the deterministic rotating fallback. It also
loads `/items/facets` with the same canonical audience slice for server-reported catalogue coverage,
saves items through `/collections`, and uses only HTTPS catalogue and purchase URLs. Missing images,
prices, unavailable ML search, expired sessions, and audience-readiness failures are shown as
explicit states; the client never invents catalogue items or scores.

Pull requests also run the `Supabase Preview` GitHub check. GYF keeps Alembic as the single
database migration source, so the check applies `services/api/db/migrations` only to a disposable
local Postgres service and runs the API suite. Remote Supabase create/update previews are
intentionally disabled because pull-request code must not run with provider tokens or generated
database credentials. Closing a pull request may still delete a pre-existing `pr-<number>` preview
branch from the reviewed base workflow only. See
[`docs/deploy/supabase-preview-security.md`](../../docs/deploy/supabase-preview-security.md) for the
active containment boundary, residual risk, and the conditions for any future remote preview.

## Production

`.github/workflows/cd.yml` deploys Expo web to EAS Hosting after the `main` CI workflow succeeds.
Before touching EAS it verifies the checked-out commit equals `workflow_run.head_sha` and equals
the current tip of the default branch, refusing to deploy a stale or mismatched source SHA, and it
fails closed (rather than silently skipping) when `EXPO_TOKEN` or the public production environment
is absent. It then runs Expo Doctor (`bun --cwd apps/expo run doctor`, also required in CI) against
the checked-in SDK and native peer set. The Expo Router configuration and enabled server
middleware emit the security headers required on every served HTML response:
`Content-Security-Policy: frame-ancestors 'none'`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and `Cross-Origin-Opener-Policy: same-origin`.
Middleware is the response-boundary defense in depth for EAS Hosting, whose prior deployment
served the four configured headers but omitted `X-Frame-Options` despite the exported route manifest
containing it. The CD job creates a non-production immutable deployment first, then rejects it
unless its `https://get-your-fit--<id>.expo.app` URL serves those headers, the exact entry bundle,
the exact Cuelinks loader and safe release identity, while the deployed API's `/health`, `/ready`,
and `/system/status` return the expected content including the matching release SHA. Only after
that verifier succeeds does the workflow run pinned `eas deploy:alias --prod --id=<id>`; a second
verification captures the promotion evidence. A verification failure therefore cannot repoint the
production alias. The alias is edge-cached for up to an hour, so its probe is best-effort and
informational, never a substitute for the pinned promotion log. EAS deployment IDs are immutable;
retain the successful deployment ID, source/API SHA and entry hash as the rollback record, then
restore production only by reassigning the alias to that verified ID. Failed runs publish a
redacted diagnostic artifact and do not claim release success.

The deploy job uses the GitHub Actions environment named `EXPO_TOKEN` and reads
`EXPO_TOKEN` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from its secrets, plus
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SUPABASE_URL` from its variables. The EAS project is pinned in `app.json`; CI passes
`--dev-domain=get-your-fit` on the immutable non-production create so the first non-interactive
deploy activates Hosting at `https://get-your-fit.expo.app`. `eas-cli` is pinned to `21.4.0`
(`apps/expo/eas.json` and every
CD/deploy invocation); `eas.json` holds native production and internal-build profiles. Store
submission remains credential-gated; no fake store deployment is claimed until Apple/Google
credentials and a successful build exist.
