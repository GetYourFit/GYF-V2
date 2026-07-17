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
# (default Render API), GYF_RECOMMEND_RUNS (default 2),
# GYF_RECOMMEND_K (default 1), GYF_RECOMMEND_CONNECT_TIMEOUT (default 10s),
# and GYF_RECOMMEND_MAX_TIME (default 90s). Exits non-zero on the first failure.
set -euo pipefail

: "${GYF_E2E_EMAIL:?set GYF_E2E_EMAIL}"
: "${GYF_E2E_PASSWORD:?set GYF_E2E_PASSWORD}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY (the public anon key)}"
SUPABASE_URL="${SUPABASE_URL:-https://tabjvaatrikogutkrjom.supabase.co}"
GYF_API_URL="${GYF_API_URL:-https://gyf-api-va.onrender.com}"
GYF_RECOMMEND_RUNS="${GYF_RECOMMEND_RUNS:-2}"
GYF_RECOMMEND_K="${GYF_RECOMMEND_K:-1}"
GYF_RECOMMEND_CONNECT_TIMEOUT="${GYF_RECOMMEND_CONNECT_TIMEOUT:-10}"
GYF_RECOMMEND_MAX_TIME="${GYF_RECOMMEND_MAX_TIME:-90}"

[[ "$GYF_RECOMMEND_RUNS" =~ ^[1-9][0-9]*$ ]] || { echo "FAIL: GYF_RECOMMEND_RUNS must be a positive integer" >&2; exit 1; }
[[ "$GYF_RECOMMEND_K" =~ ^[1-9][0-9]*$ ]] || { echo "FAIL: GYF_RECOMMEND_K must be a positive integer" >&2; exit 1; }

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
auth_config="$tmp_dir/auth.curl"
session_config="$tmp_dir/session.curl"
auth_payload="$tmp_dir/auth.json"
chmod 700 "$tmp_dir"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# 1. Anonymous /me must be refused — otherwise "authenticated" proves nothing.
anon_code=$(curl -sS -o /dev/null -w '%{http_code}' "${GYF_API_URL}/me")
[[ "$anon_code" == "401" || "$anon_code" == "403" ]] ||
  fail "anonymous /me returned ${anon_code}, expected 401/403"
echo "ok: anonymous /me refused (${anon_code})"

# 2. Password sign-in on the deployed Supabase Auth. Credentials go through
# mode-0600 files, never process arguments visible to another local process.
printf 'header = "apikey: %s"\nheader = "Content-Type: application/json"\n' \
  "$SUPABASE_ANON_KEY" > "$auth_config"
printf '%s\n%s' "$GYF_E2E_EMAIL" "$GYF_E2E_PASSWORD" | python3 -c \
  'import json,sys; print(json.dumps({"email": sys.stdin.readline().rstrip("\n"), "password": sys.stdin.read()}))' \
  > "$auth_payload"
chmod 600 "$auth_config" "$auth_payload"
token_response=$(curl -sS --config "$auth_config" -X POST \
  "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  --data-binary "@${auth_payload}")
access_token=$(printf '%s' "$token_response" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
[[ -n "$access_token" ]] ||
  fail "sign-in issued no access_token"
printf 'header = "Authorization: Bearer %s"\n' "$access_token" > "$session_config"
chmod 600 "$session_config"
echo "ok: deployed Supabase sign-in issued a session"

# 3. The session round-trips through the deployed API.
me_response=$(curl -sS -w '\n%{http_code}' "${GYF_API_URL}/me" \
  --config "$session_config")
me_code=${me_response##*$'\n'}
me_body=${me_response%$'\n'*}
[[ "$me_code" == "200" ]] || fail "/me with session returned ${me_code}: ${me_body}"
me_email=$(printf '%s' "$me_body" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("email") or "")')
[[ "$me_email" == "$GYF_E2E_EMAIL" ]] ||
  fail "/me email '${me_email}' does not match signed-in user '${GYF_E2E_EMAIL}'"
echo "ok: authenticated /me round-trip returned the signed-in identity"

# 4. Ensure the dedicated test account has the minimum manual profile. Existing
# profiles are preserved; a fresh disposable account gets only deterministic fields.
profile_response=$(curl -sS -w '\n%{http_code}' "${GYF_API_URL}/profile" \
  --config "$session_config")
profile_code=${profile_response##*$'\n'}
if [[ "$profile_code" == "404" ]]; then
  profile_code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
    "${GYF_API_URL}/profile" --config "$session_config" \
    -H 'Content-Type: application/json' \
    --data '{"gender":"women","style_intent":["minimalist"],"budget_range":{"max":5000,"currency":"INR"},"occasion":"casual"}')
fi
[[ "$profile_code" == "200" ]] || fail "profile prerequisite returned ${profile_code}"
echo "ok: recommendation profile prerequisite exists"

# 5. Authenticated recommendation smoke test (cold then warm by default).
for run in $(seq 1 "$GYF_RECOMMEND_RUNS"); do
  phase=cold; [[ "$run" -gt 1 ]] && phase=warm
  request_id="gyf-auth-recommend-${run}-$(date +%s)-$$-${RANDOM}"
  body_file="$tmp_dir/body-${run}"
  headers_file="$tmp_dir/headers-${run}"
  timing=$(curl -sS --connect-timeout "$GYF_RECOMMEND_CONNECT_TIMEOUT" \
    --max-time "$GYF_RECOMMEND_MAX_TIME" -D "$headers_file" -o "$body_file" \
    -w 'dns=%{time_namelookup}s connect=%{time_connect}s ttfb=%{time_starttransfer}s total=%{time_total}s code=%{http_code}' \
    "${GYF_API_URL}/outfits/recommend?occasion=casual&k=${GYF_RECOMMEND_K}" \
    --config "$session_config" -H "X-Request-ID: ${request_id}") ||
    fail "recommendation request ${run} failed (request_id=${request_id})"
  code=${timing##*code=}
  [[ "$code" == "200" ]] || fail "recommendation request ${run} returned ${code} (request_id=${request_id})"
  printf '%s' "$timing" | sed "s/ code=.*//" | sed "s/^/ok: recommendation ${run} ${phase} (${request_id}) /"
  echoed_id=$(awk -F': ' 'tolower($1) == "x-request-id" {gsub("\r", "", $2); print $2}' "$headers_file" | tail -n 1)
  [[ "$echoed_id" == "$request_id" ]] || fail "recommendation ${run} did not echo X-Request-ID (request_id=${request_id})"
  python3 - "$body_file" <<'PY' || fail "recommendation ${run} body missing recommendation_id or outfits (request_id=${request_id})"
import json, sys
body = json.load(open(sys.argv[1]))
assert body.get("recommendation_id")
assert isinstance(body.get("outfits"), list) and body["outfits"]
outfit = body["outfits"][0]
assert isinstance(outfit.get("items"), list) and outfit["items"]
assert isinstance(outfit.get("explanation"), str) and outfit["explanation"].strip()
assert isinstance(outfit.get("confidence"), (int, float))
PY
done

echo "PASS: deployed authenticated session verified (${GYF_API_URL})"
