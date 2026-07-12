# GYF Photo Evaluation Study v1

Purpose: collect a small, balanced, consented skin-tone evaluation set. This is not production
onboarding and does not grant model-training permission.

## Participant consent

Before capture, participant must actively confirm:

- I am 18 or older and choose to participate.
- GYF may use these face photos and human labels only to evaluate skin-tone estimation.
- Participation does not affect access to GYF.
- Approved processors and trained reviewers may handle evaluation data.
- Photos and identity mapping stay private; repository contains only aggregate reports.
- Photos are deleted by the retention date or earlier when I withdraw.
- I can withdraw through `gyf1ltd@gmail.com` using my consent receipt.
- Permission excludes model training, marketing, and public display.

Record `photo-eval-v1`, timestamp, random receipt ID, retention date, and allowed use `evaluation`.
Keep receipt-to-person mapping separate from photos and manifests.

## Capture and labels

Capture natural-daylight and ordinary-indoor face photos without filters. Use random `subject_id`
and `sample_id`; never put name/email in manifest. Participant selects an MST range, then two
reviewers label independently. Exclude unresolved disagreement. All photos from one subject use one
split.

Private JSONL manifest fields enforced by `common.photo_study.load_manifest`: `sample_id`,
`subject_id`, relative `path`, `sha256`, `true_mst`, `consent_receipt`, `consent_version`,
`allowed_uses`, `delete_after`, optional `withdrawn_at`, and `split`.

```bash
cd ml
uv run python -c "from pathlib import Path; from common.photo_study import load_manifest; print(len(load_manifest(Path('PRIVATE/manifest.jsonl'))))"
```

Photos, manifest, and receipts never enter git. Commit only redacted data card and aggregate report.
Get legal/privacy review for target jurisdictions before recruitment.

## Internet images

Internet visibility is not permission. External samples need documented commercial-use license,
subject/privacy basis, reliable MST ground truth, provenance, and deletion/retention rights.
Licensed public datasets can benchmark research, but cannot replace target-user evaluation unless
all conditions pass. Merchant product images are safer for garment retrieval because feed terms can
grant use and no biometric labels are inferred.
