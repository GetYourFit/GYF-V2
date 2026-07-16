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

SDK 57.0.6, React Native 0.86.0, and the new architecture are pinned in `package.json` and
`app.json`. The route directory contains routes only; components and utilities live under `src`.

## Live surfaces

The signed-in `Stylist` tab calls `/outfits/recommend` and records save/skip feedback against the
returned recommendation. `Explore` calls `/items/browse` for an unfiltered catalogue page and
switches to `/items/search` whenever a query, slot, sort, or maximum-price filter is active. This
keeps filters truthful because browse intentionally ignores those search filters. It also loads
`/items/facets` for server-reported catalogue coverage, saves items through `/collections`, and
uses only HTTPS catalogue and purchase URLs. Missing images, prices, unavailable ML search, and
expired sessions are shown as explicit states; the client never invents catalogue items or scores.

Pull requests also run the `Supabase Preview` GitHub check. GYF keeps Alembic as the single
database migration source, so the check applies `services/api/db/migrations` to a disposable
Postgres service and runs the API suite. To use an isolated hosted Supabase branch as well, add
`SUPABASE_ACCESS_TOKEN` as a secret and `SUPABASE_PROJECT_REF` as a variable in the existing
`EXPO_TOKEN` GitHub Actions environment. The workflow names branches `pr-<number>`, never copies
production data, and deletes the branch when the pull request closes. Without those optional
credentials, the local preview contract still runs and production remains untouched.

## Production

`.github/workflows/cd.yml` deploys Expo web to EAS Hosting after the `main` CI workflow succeeds.
The deploy job uses the GitHub Actions environment named `EXPO_TOKEN` and reads
`EXPO_TOKEN` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from its secrets, plus
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SUPABASE_URL` from its variables. The EAS project is pinned in `app.json`; CI passes
`--dev-domain=get-your-fit` so the first non-interactive deploy activates Hosting at
`https://get-your-fit.expo.app`. `eas.json` holds native production and internal-build profiles. Store submission
remains credential-gated; no fake store deployment is claimed until Apple/Google credentials and
a successful build exist.
