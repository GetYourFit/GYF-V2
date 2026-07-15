# GYF Expo client

This is the SDK-pinned Expo Router client for the migration. It reuses the existing typed API
contract and stores native Supabase sessions in SecureStore. The existing Next.js client remains
the rollback/oracle surface until route parity and production cutover gates pass.

## Run

```bash
bun install
bun --cwd apps/expo start
```

Try Expo Go first. Set `EXPO_PUBLIC_API_URL` to point at the API; it is public configuration,
not a secret. The shell defaults to `http://localhost:8000`; configured production origins must use HTTPS.
Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for auth. Native sessions use
SecureStore; web uses browser session storage. Never put service-role keys or access tokens in
`EXPO_PUBLIC_*` values.

SDK 57.0.6, React Native 0.86.0, and the new architecture are pinned in `package.json` and
`app.json`. The route directory contains routes only; components and utilities live under `src`.

## Production

`.eas/workflows/deploy.yml` deploys Expo web on every `main` push. Link this app once with an
authenticated EAS account, then configure `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment values. `eas.json` holds native production and
internal-build profiles. Store submission remains credential-gated; no fake store deployment is
claimed until Apple/Google credentials and a successful build exist.
