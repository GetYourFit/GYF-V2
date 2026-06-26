<!-- Generated: 2026-06-27 | FastAPI (Python 3.12, uv) | ~450 tokens -->
# Backend (services/api/app)

## Routes (main.py)
```
GET    /health · /me · /metrics · /gallery · /              (ops + visual tester)
GET    /items/search                → catalog/retrieval.py (pgvector ANN + region filter)
GET    /items/{id}/similar          → catalog/retrieval.py
GET/PUT/DELETE /profile             → profile/repository.py
POST   /profile/photo               → profile/photo.py (consent-gated, EXIF-stripped)
GET/PUT /consent                    → profile/*
DELETE /account                     → profile/purge.py (tombstone + cascade)
GET    /outfits/recommend           → recsys/compose.py → taste.py + candidates.py
POST   /feedback                    → events (interactions table) — D4 flywheel
```
*Missing (built in W4): `/collections` (saved), `/wardrobe/items`, `/social/*`, `/profile/summary`.*

## Key modules
- `auth.py` — JWT verify (ES256 via JWKS / HS256 secret); generic 401 (M-3 fixed).
- `config.py` — typed settings; `auth_is_open` guarded so bypass is local-only (H-1 fixed).
- `catalog/` — `ingest.py`, `perception.py`, `retrieval.py`, `candidates.py` (parameterized SQL).
- `recsys/` — `compose.py`, `taste.py`, `goals.py` (NL intent), `conditioning.py` (occasion/region).
- `profile/` — `account.py`, `photo.py`, `purge.py`, `repository.py`.

## Cross-cutting (planned)
- Rate limiting (H-3 → W1), Postgres RLS (H-4 → W6), security headers (web, M-2 → W6).

## Stores
Postgres+pgvector (primary) · Redis (cache/limit) · event sink (JSONL→Postgres→Redpanda).
