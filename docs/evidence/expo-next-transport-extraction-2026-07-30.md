# Expo/Next transport extraction evidence — 2026-07-30

## Decision and scope

This packet is the safe extraction stage of the protected Next.js retirement path. Expo is
runtime-independent from the repository-root `app/` implementation. The Next implementation,
provider references, CI/workspace ownership and rollback assets remain intact; F13 deletion is
**not authorized** by this evidence.

## Dependency and ownership graph

```text
FastAPI OpenAPI schema
  └─ make types
     └─ packages/types/src/api.ts (generated; not hand-edited)
        └─ packages/api-client/src/api.ts
           ├─ platform fetch/FormData/AbortSignal/Headers only
           ├─ injected TokenProvider (no Supabase import)
           ├─ apps/expo/src/lib/api.ts
           │  └─ Expo publicEnv + Supabase getAccessToken adapter
           └─ app/lib/api.ts (thin Next compatibility facade)
              └─ NEXT_PUBLIC_API_URL + app/lib/api-client.ts cookie/refresh adapter
```

The Expo application routes/components continue to import `@/lib/api`, but that binding now
forwards to `@gyf/api-client`; no Expo runtime import resolves into root `app/`. Public contact
constants moved to `@gyf/types`; `app/lib/contact.ts` is also only a compatibility export.

The root `app/` remains owned by the Next rollback/oracle path: `app/package.json`, Next routes,
`app/lib/api-client.ts` and Supabase browser/session helpers; `app/Dockerfile` and
`infra/container-stack.sh` remain local Next development support. CI/CD deploys Expo only; the
Vercel CORS origin, `vercel.json`, provider state and historical rollback evidence were not
changed.

## Extracted boundary

- New `@gyf/api-client` workspace package owns one `GyfApi`, `ApiError`, generated query/response
  aliases, multipart `MultipartFile`, and `TokenProvider` boundary.
- Preserved bearer injection, injected Supabase session providers, stable `X-Request-ID` per
  logical request/retry, feedback `event_id` plus `Idempotency-Key`, JSON and multipart/file
  semantics, caller `AbortSignal`, 15-second timeout, bounded safe-GET/network retry, no retry
  for slate-logging or multipart mutations, and honest 204/error mapping.
- 401/403/404/429/503 status predicates and error details remain available. Request IDs are also
  carried on `ApiError` for failed calls.
- OpenAPI-generated operations/components are used for request query and response envelope types.
  Anonymous FastAPI map responses retain explicit consumed fields as intersections until the API
  publishes named response schemas. `make types` regenerated `packages/types/src/api.ts`; it had
  no resulting diff.

## Guards and tests

- `scripts/check_client_boundaries.py` is wired into `make doctrine` and CI. It rejects Expo
  runtime imports resolving into root `app/` and framework imports (`next`, React, Expo, Supabase,
  Vercel) in the transport package.
- `scripts/ownership_inventory.py --check` now has no legacy Expo-to-Next import exceptions.
- `packages/api-client/src/contract.test.ts`: every client endpoint method is exercised for route,
  verb, bearer, request ID, multipart boundary, and feedback idempotency.
- Shared transport: **21 tests pass** (20 behavior/status tests plus the endpoint matrix).
- Expo: **274 tests pass**; focused activation and photo transport tests pass, including manual and
  no-photo fallback/abstention states, consent and Cuelinks attribution coverage.
- Retained Next facade: **81 tests pass**, including the unchanged API parity suite.
- API: **589 passed, 26 environment-gated skips, 8 warnings**.
- Clean dependency install: `bun install --frozen-lockfile` passed. Expo Doctor: **17/17 passed**.
- `make ci` passed (format, lint, typecheck, doctrine, standards and full suites). Doctrine passed
  hygiene, workflow security, ownership, Expo hosting, model licence/promotion, ports and doc
  alignment checks. Existing warnings are the Next raw-`<img>` advisory, Vitest/Vite Rolldown and
  React `act(...)` notices, plus API Starlette/httpx, short test JWT, and 422 deprecation warnings.

## Measurement

| Measure | Pre-extraction reference | Extraction measurement |
| --- | ---: | ---: |
| `app/lib/api.ts` source | 23,161 B | 907 B facade |
| Expo `src/lib/api.ts` | 731 B | 812 B binding |
| shared implementation | embedded in `app/lib/api.ts` | 25,274 B in `packages/api-client/src/api.ts` |
| Expo web entry bundle | 2,499,238 B in the active-contract prior evidence | 2,859,282 B main entry; 9,883,212 B complete local `dist` file sum |
| Expo export | prior local/deployed export evidence | 14.26 s, max RSS 48,742,400 B, Cuelinks verifier passed |
| Next build | prior builds exist, but no comparable clean local memory sample | compiled in 5.3 s, then local TypeScript phase was SIGKILL; 6.95 s, max RSS 837,353,472 B |

The bundle is larger than the cited prior reference and the Next build was killed by the local
environment. Neither is treated as deletion permission; a clean before/after bundle attribution,
resource budget review and reliable Next rollback build remain open.

## F13/retirement gates still open

1. Full Expo-vs-Next route and behavioral parity evidence across auth/onboarding/photo/manual,
   Stylist, Explore/search/browse/similar/facets, wardrobe, social/profile, collections, account/
   privacy, commerce attribution and every degraded/error state.
2. Browser/E2E parity on the deployed candidate, not only mocked contract and local route tests.
3. Physical Android device evidence: launch/navigation/deep links, offline/retry/image failure,
   TalkBack, largest text, reduced motion, rotation, keyboard/safe areas, performance/memory/
   scrolling and rollback journey. No physical device proof was produced here.
4. Immutable Expo deployment at this exact commit with deployment ID, entry hash, required headers,
   live API compatibility and tested alias rollback. This lane has no EAS token/login, so no new
   immutable deployment proof exists.
5. Clean production API/Expo release correlation and request-behavior evidence on deployed Virginia
   plus tested Expo rollback window. Local API tests are not deployed proof.
6. Full no-mistakes review/test/document/lint/push/PR/CI pipeline and current-main CI evidence for
   this branch/commit. This packet has not been through no-mistakes yet.
7. Captain-authorized protected F13 deletion decision after all evidence above, with historical
   evidence retention and one tested Expo rollback artifact.

## Deletion list — held, not performed

Only after the gates above pass may a same-slice F13 retirement packet consider deleting the
root `app/` implementation and its dedicated Next dependencies/config (`app/`, `app/package.json`
Next/Vercel dependencies, `app/Dockerfile`, Next-only local container wiring), then removing any
now-unowned Next workspace/CI/CODEOWNERS/provider references. It must separately prove whether
`vercel.json`, Vercel CORS/provider state and historical docs/evidence are still retained by the
captain-authorized provider-retirement packet. No file in that list was deleted here.
