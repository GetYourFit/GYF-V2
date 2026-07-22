# GYF — Historical Free Deploy Checklist

Status: **SUPERSEDED HISTORICAL RUNBOOK — DO NOT EXECUTE**. It records the original free-preview
Vercel/Render path for archaeology only and remains until protected F13 deletion. Current deployment,
commercial hosting, rollback, security and cost authority lives in
[`../plans/active-execution-contract.md`](../plans/active-execution-contract.md),
[`../plans/gyf-launch-refactor-plan.md`](../plans/gyf-launch-refactor-plan.md) and
[`../plans/scale-3k-inr.md`](../plans/scale-3k-inr.md).

## Current replacement summary

- **Web:** Expo web/static is the active direction. Repository CD deploys `apps/expo` to EAS
  Hosting (`https://get-your-fit.expo.app`) after main CI succeeds. Render Static is the current
  commercial static-host candidate after Expo-web parity and the required F10/F11 evidence.
- **API:** production is the single paid Render Starter service in **Virginia**. Oregon is
  suspended rollback-only until its gate closes. Singapore is prohibited.
- **Next.js:** `app/` is preserved as a protected rollback/oracle client until F13/cutover; it is
  not a routine production deployment target.
- **Vercel:** Hobby/production deploy guidance from the old checklist is obsolete for this
  affiliate product. This repository must not re-add CI, Makefile or runbook steps that deploy
  production web to Vercel.
  External Vercel project state and credentials are intentionally not changed here.

## Do not run the old checklist

The old instructions deployed the Next.js website to Vercel project `gyf-v2-app`, used
`NEXT_PUBLIC_*` Vercel production variables, and described `make deploy-web`/Git auto-deploy as the
normal path. Those commands have been removed or disabled repository-side because they conflict with
the current Expo web/static target and commercial-hosting constraints.

If historical rollback/oracle evidence mentions `https://gyf-v2-app.vercel.app`, preserve that
evidence until F13. Do not convert it into new production automation.

## Safe current pointers

- Use [`../../infra/SETUP.md`](../../infra/SETUP.md) for repo-side infrastructure/deploy setup.
- Use `apps/expo/README.md` for Expo runtime and production environment variables.
- Use `render.yaml` only as the documented API configuration for the existing Virginia Render
  service; do not let a Blueprint create duplicate paid services.
- Keep secrets server-side: never put Supabase service-role keys, user JWTs, Vercel tokens or
  provider credentials in Expo public variables or Render public config.
