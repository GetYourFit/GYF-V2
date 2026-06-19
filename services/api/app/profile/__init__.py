"""User modeling — onboarding profiles (P1-B).

The API owns the ``profiles`` schema, so the onboarding flow (manual path in
Cycle 1) lives here: validate input against the shared user-model vocabularies
(:mod:`gyf_contracts.usermodel`), persist with per-field confidence and
provenance, and support full deletion. The photo-based body-type and
fairness-gated skin-tone modules (Cycle 2/3) write into the same schema.
"""
