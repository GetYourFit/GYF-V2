# Photo-assistance evaluation panels

`photo-assistance-placeholder.json` is intentionally empty and **cannot promote** either photo
assistant. It exists only to validate the manifest path and report schema without fabricating
fairness evidence.

## Captain decision hold — source a real diverse panel

Before F7 promotion, the captain must approve a separately consented, rights-cleared and diverse
panel for each body/tone candidate. The approval must identify the panel source and version,
consent purpose, data licence, **collection provenance**, independent label protocol, subgroup
schema (including `band` plus lighting and other approved audit slices), retention/deletion
handling, and the model version under evaluation. Store the sensitive panel outside this repository
and set its path with `GYF_PHOTO_FAIRNESS_PANEL` (or pass it to
`python -m usermodel.photo_fairness_eval`).

The manifest must also carry the captain's `attestation_id` and a `cohort_justification` with a
pre-registered power-analysis (or equivalent statistical) reference plus justified `minimum_total`
and `minimum_per_band`. A two-sample cohort is categorically ineligible. The protected evaluation
or CI environment—not the manifest—must supply the exact canonical SHA-256 digest through
`GYF_PHOTO_FAIRNESS_PANEL_DIGEST` and the matching ID through
`GYF_PHOTO_FAIRNESS_PANEL_ATTESTATION_ID`. These independently protected values bind the
promotion report to the exact approved panel; a locally authored manifest that declares itself
approved cannot pass.

A report may pass the machine gate only when the exact protected attestation, provenance,
cohort justification and all required metrics are present. This is necessary but not sufficient for
production: model licence, privacy, rollback and the remaining F7 evidence gates still apply.
Manual values remain authoritative and both runtime candidates stay research/shadow until all gates
pass.
