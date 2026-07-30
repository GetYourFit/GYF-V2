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

After the `main` CI workflow succeeds, `.github/workflows/cd.yml` selects exactly one web release
job. `RENDER_PRODUCTION_ENABLED=true` selects the authorized Render Static
candidate-before-production transaction; while that switch is absent or false, the retained EAS
Hosting transaction remains active. Both paths verify the exact successful-main source and API
release identity and fail closed on missing provider configuration. The authoritative setup,
response-boundary, provenance, rollback, and external-blocker details live in the
[Render Static Expo release contract](../../docs/deploy/render-expo-static.md).

The EAS project and native production/internal profiles remain pinned in `app.json` and `eas.json`;
`eas-cli` remains pinned to `21.4.0`. Store submission is still credential-gated, and no native
release is claimed until Apple/Google credentials and a successful build exist.
