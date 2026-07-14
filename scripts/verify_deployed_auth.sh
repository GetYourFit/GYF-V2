#!/usr/bin/env bash
# F1c — exact deployed authenticated-session integration check.
#
# Proves, against the DEPLOYED stack (no local fakes), that:
#   1. an unauthenticated call to the API's /me is refused (401/403),
#   2. password sign-in against the deployed Supabase Auth issues a session,
#   3. that session round-trips: GET /me returns 200 with the same email.
#
# Run verbatim (credentials come from the environment, never this file):
#
#   GYF_E2E_EMAIL=... GYF_E2E_PASSWORD=... SUPABASE_ANON_KEY=... \
#     bash scripts/verify_deployed_auth.sh
#
# Optional overrides: SUPABASE_URL (default prod project), GYF_API_URL
# (default Render API). Exits non-zero on the first failed claim.
set -euo pipefail

: "${GYF_E2E_EMAIL:?set GYF_E2E_EMAIL}"
: "${GYF_E2E_PASSWORD:?set GYF_E2E_PASSWORD}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY (the public anon key)}"
SUPABASE_URL="${SUPABASE_URL:-https://tabjvaatrikogutkrjom.supabase.co}"
GYF_API_URL="${GYF_API_URL:-https://gyf-api.onrender.com}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# 1. Anonymous /me must be refused — otherwise "authenticated" proves nothing.
anon_code=$(curl -sS -o /dev/null -w '%{http_code}' "${GYF_API_URL}/me")
[[ "$anon_code" == "401" || "$anon_code" == "403" ]] ||
  fail "anonymous /me returned ${anon_code}, expected 401/403"
echo "ok: anonymous /me refused (${anon_code})"

# 2. Password sign-in on the deployed Supabase Auth.
token_response=$(curl -sS -X POST \
  "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${GYF_E2E_EMAIL}\",\"password\":\"${GYF_E2E_PASSWORD}\"}")
access_token=$(printf '%s' "$token_response" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
[[ -n "$access_token" ]] ||
  fail "sign-in issued no access_token: $(printf '%s' "$token_response" | head -c 300)"
echo "ok: deployed Supabase sign-in issued a session"

# 3. The session round-trips through the deployed API.
me_response=$(curl -sS -w '\n%{http_code}' "${GYF_API_URL}/me" \
  -H "Authorization: Bearer ${access_token}")
me_code=${me_response##*$'\n'}
me_body=${me_response%$'\n'*}
[[ "$me_code" == "200" ]] || fail "/me with session returned ${me_code}: ${me_body}"
me_email=$(printf '%s' "$me_body" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("email") or "")')
[[ "$me_email" == "$GYF_E2E_EMAIL" ]] ||
  fail "/me email '${me_email}' does not match signed-in user '${GYF_E2E_EMAIL}'"
echo "ok: authenticated /me round-trip returned the signed-in identity"

echo "PASS: deployed authenticated session verified (${GYF_API_URL})"
