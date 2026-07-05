
## 2026-07-05 (contd.) — ship→review→verify loop on the perf batch

Ran the perf commit through the ECC reviewer loop (react-reviewer +
python-reviewer in parallel) and verified prod live.

**Prod verified:** Render redeployed — `/items/facets` serves
`Cache-Control: public, max-age=3600` (Cloudflare DYNAMIC, so only browsers
cache; they key on the full URL incl. ?region= — noted in code). Facets now
report 9,161 priced items (real prices are live).

**Review findings applied (066cfd9):** clearTimeout on the 3s token race
(dangling timer per API call); `mediaUrl` skips appending `width=` when the
Shopify URL already carries one. Rejected: spread-composing the api object
(createApi returns a class instance — spread drops prototype methods; kept
bind-wrap with a comment). Deferred as follow-ups, not defects: srcset/retina
variants; 401-retry after a boxed token-refresh fallback (documented
tradeoff). API-side review clean (encoder singleton confirmed, lru_cache
thread-safe, ~10-20MB worst-case cache, no PII in facets).

**Gate:** tsc ✓ web 24 ✓ ruff + API 258 ✓.
