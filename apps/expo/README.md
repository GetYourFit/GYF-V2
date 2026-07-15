# GYF Expo client

This is the SDK-pinned Expo Router shell for the client migration. The existing Next.js
client remains the rollback/oracle surface until route parity and the production cutover gates
pass.

## Run

```bash
bun install
bun --cwd apps/expo start
```

Try Expo Go first. Set `EXPO_PUBLIC_API_URL` to point at the API; it is public configuration,
not a secret. The shell defaults to `http://localhost:8000` and rejects non-HTTP(S) values.

SDK 57.0.6, React Native 0.86.0, and the new architecture are pinned in `package.json` and
`app.json`. The route directory contains routes only; components and utilities live under `src`.
