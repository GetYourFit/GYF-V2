<!-- Generated: 2026-06-27 | Postgres 16 + pgvector | ~350 tokens -->
# Data (services/api/db)

## Tables (schema.sql)
```
users            id, auth ref, tombstone        — account; ON DELETE CASCADE to interactions
profiles         user_id → skin_tone, undertone, body_type, style_intent[], budget, occasion
items            id, attributes, region, image_refs[]   — catalog garments
item_embeddings  item_id → vector(pgvector)             — perception output, ANN source
outfits          generated looks   ⚠ no user_id (add L-2 → W4)
interactions     user_id, item/outfit, event (save/skip/cart/...) — D4 flywheel, event-sourced
models           registry rows (eval/promotion)
alembic_version  migration head
```

## Relationships
`profiles.user_id → users.id` · `item_embeddings.item_id → items.id` ·
`interactions.user_id → users.id` (CASCADE). Outfit↔user only via interactions today.

## Migrations
Alembic in `db/migrations/`; snapshot `db/schema.sql`. Planned: `outfits.user_id` (W4),
**RLS policies** on profiles/users/interactions/outfits (H-4 → W6).

## Security posture
`row_security = off`, zero `CREATE POLICY` today → app-layer is the only backstop (H-4, must fix
before deploy). Queries parameterized (no injection). Biometric data (skin tone, measurements)
makes RLS a compliance/trust requirement.
