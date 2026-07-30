# Render Static Expo release contract

**Owner:** `.github/workflows/cd.yml`, job `deploy-render-static`. EAS and Vercel remain
retained comparison/rollback assets until this lane proves the canonical URL.

## Provider setup

`infra/render-expo-static.yaml` is the provider setup artifact. It defines two Render Static
services in the already-approved workspace:

- `gyf-expo-web-candidate` — isolated candidate URL; never the canonical URL.
- `gyf-expo-web` — retained production service; its configured URL must be the approved
  `https://get-your-fit.expo.app` only after the provider-side domain attachment is already
  authorised. This task does not change DNS or attach/detach domains.

The Render production environment in GitHub must contain `RENDER_API_KEY` as a secret and
`RENDER_WORKSPACE_ID`, `RENDER_CANDIDATE_SERVICE_ID`, `RENDER_PRODUCTION_SERVICE_ID`, `RENDER_CANDIDATE_URL`,
`RENDER_PRODUCTION_URL`, `RENDER_CANONICAL_URL`, `EXPO_PUBLIC_API_URL`, and
`EXPO_PUBLIC_SUPABASE_URL` as variables. `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a secret. The
`RENDER_PRODUCTION_ENABLED=true` variable is the explicit owner switch; while it is absent or
false, the existing EAS production lane remains unchanged.

The setup artifact deliberately contains no provider token, custom domain, DNS operation or
unapproved service ID. Render CLI v2.7.0 is installed from its pinned release in CI and the
artifact is validated with the current `render blueprints validate` command before deployment.

## Transaction

1. CI checks out the exact successful main workflow SHA and confirms main has not advanced.
2. Expo web is exported locally; Cuelinks, public API/Supabase configuration and entry bundle
   name/hash are recorded.
3. Render CLI deploys that SHA to the candidate service and waits for completion.
4. `verify-render-static-deploy.mjs` probes the candidate's real HTML, hashed entry asset,
   `/__deployment/api`, an actual missing-route error, and API `/health`, `/ready`, and
   `/system/status`. Every response must carry CSP `frame-ancestors 'none'`, COOP `same-origin`,
   strict-origin referrer policy, `nosniff`, and `X-Frame-Options: DENY`. The identity and API
   release SHA must equal the source SHA, and the export/live Cuelinks evidence must match.
   Headless Chrome must also directly load and render the welcome, terms, contact, and grievance
   surfaces without an application error overlay.
5. Only after step 4 succeeds does CI deploy the same SHA to `gyf-expo-web`.
6. CI verifies the configured production/canonical URL again, then records provenance and the
   prior successful production deploy.

A candidate failure stops the job before the production deploy command. The failure artifact
contains stage, service IDs, URLs, source SHA, and available deploy records without secrets.

## Response boundary and cache contract

Render Static's `headers` rules in `infra/render-expo-static.yaml` are the actual CDN response
boundary. The `/*` rule applies to HTML, hashed assets, the identity rewrite and error responses.
The identity path is `no-store`; HTML is `no-cache`; hashed assets remain provider-managed static
assets. The verifier tests live HTTP responses rather than trusting YAML. The API already applies
the same security middleware to successful and error responses.

The static `/__deployment/api` JSON is generated during the Render build from
`RENDER_GIT_COMMIT` (or the explicitly supplied release SHA). It records the source/release SHA,
entry bundle/hash, content hashes, build time and provider name. The API `/system/status`
`release_sha` is checked against the same SHA.

## Provenance and rollback

Each successful artifact records source SHA, CI run ID, candidate and production service/deploy
IDs, candidate URL, production/canonical URL, entry bundle/hash, response headers, cache-freshness
probes, API release SHA, Cuelinks export/live evidence and timestamp.

Render Static does **not** provide an immutable public URL for each deploy. The isolated candidate
service URL is therefore the candidate evidence URL, not an immutable deployment URL. The Render
deploy ID and the previous successful production deploy ID are retained. The exact rollback
procedure is:

```bash
curl --fail --request POST "https://api.render.com/v1/services/$RENDER_PRODUCTION_SERVICE_ID/rollback" \
  --header "Authorization: Bearer $RENDER_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"deployId":"<retained-successful-production-deploy-id>"}'
```

Render's documented rollback reuses the retained build artifact; static-site headers/domains are
current service configuration and are not reverted by rollback. Re-run the same live verifier
against the canonical URL after rollback. The release record states this limitation precisely;
it does not claim EAS-style immutable provenance.

## Remaining external gate

At the time this contract is added, the worktree has no `RENDER_API_KEY`, Render service IDs or
Render candidate/production URLs, and `https://get-your-fit.expo.app` is still EAS-hosted. Those
are concrete provider-setup credentials/access blockers, not reasons to weaken verification.
Until the approved Render services are provisioned, the switch stays disabled and no DNS/provider
retirement is performed.
