# ml/

The GYF ML platform. Modules (built per `docs/implementation-plan.md`, grounded in
`docs/research/deep-research-report.md`):

- `perception/` — fashion embeddings (Marqo-FashionSigLIP), attributes, color (CIELAB/CAM16)
- `usermodel/` — body-type module (SMPL) and skin-tone module (separate, fairness-gated ⚠️)
- `recsys/` — two-tower, transformer ranker, generative (Semantic IDs / TIGER) later
- `compat/` — outfit compatibility & composition
- `tryon/` — diffusion virtual try-on (IDM-VTON → MuGa-VTON)
- `eval/` — offline + online evaluation harness (gates every model release)
- `pipelines/` — training/feature pipelines, registry hooks

Built in P1+. P0 establishes the data/event spine these consume.
