# Supabase PR preview security boundary

Status: **ACTIVE CONTAINMENT**. Alembic remains the sole schema source. On every open or updated
pull request, `.github/workflows/supabase-preview.yml` checks out and proves that PR's migrations
only against disposable local PostgreSQL. It receives no Supabase/provider token, generated database
URL, release credential, or GitHub environment secret.

The previous remote create/update Supabase-branch preview is intentionally disabled. Closing a pull
request may still delete its pre-existing `pr-<number>` provider branch. That cleanup is limited to
the reviewed base workflow: it does not check out, download, or execute PR code, local/composite
actions, or artifacts. Production is never targeted by this workflow.

`scripts/check_workflow_security.rb` parses workflow YAML and is run by `make doctrine` and CI. It
rejects a PR-triggered sensitive job unless it is closed-PR cleanup, and rejects checkout, artifact
consumption, and PR-head expression use in such a cleanup job. This is a containment control, not a
credential rotation or a replacement for action-supply-chain review.

Residual risk remains in trusted workflow/actions and in the provider cleanup credential. Remote
create/update previews may return only after a separately reviewed design proves either (a) an
isolated disposable database path that needs no provider token or generated credential while PR code
runs, or (b) migration execution exclusively from a trusted reviewed ref with no PR code/artifact,
local action, dependency installation, shell interpolation, or workflow-expression input crossing
into the credentialed job. The local PostgreSQL/Alembic contract remains the required PR migration
proof until then.
