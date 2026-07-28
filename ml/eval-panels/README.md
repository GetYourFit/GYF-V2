# Photo-assistance evaluation panels

`photo-assistance-placeholder.json` is intentionally empty and **cannot promote** either photo
assistant. It exists only to validate the manifest path and report schema without fabricating
fairness evidence.

## Captain decision hold — source a real diverse panel

Before F7 promotion, the captain must approve a separately consented, rights-cleared and diverse
panel for each body/tone candidate. The approval must identify the panel source and version,
consent purpose, data licence, independent label protocol, subgroup schema (including `band` plus
lighting and other approved audit slices), retention/deletion handling, and the model version under
evaluation. Store the sensitive panel outside this repository and set its path with
`GYF_PHOTO_FAIRNESS_PANEL` (or pass it to `python -m usermodel.photo_fairness_eval`).

A report may pass the machine gate only when the manifest marks the approved panel and records all
required metadata. This is necessary but not sufficient for production: model licence, privacy,
rollback and the remaining F7 evidence gates still apply. Manual values remain authoritative and
both runtime candidates stay research/shadow until all gates pass.
