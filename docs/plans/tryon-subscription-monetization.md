# Try-on subscription monetization plan

Status: **ACTIVE** · owner decision 2026-07-14 · subordinate to
[`active-execution-contract.md`](./active-execution-contract.md) (amended the same day)

## Owner decision

Virtual try-on moves **behind a subscription paywall** so its GPU cost is recovered and margin is
reinvested. **Everything else in GYF stays free**: onboarding, the stylist feed, explanations,
confidence, NL goals, occasion, Explore, collections, wardrobe, wardrobe-aware recommendations,
social, profile/badges, colour/photo assistance. This preserves the mission — the stylist
intelligence stays universal and free; only the GPU-rendered mirror is paid.

The earlier "try-on is free" clause and the cancellation of payment work are superseded. Payment
work is re-authorised **strictly scoped to the try-on subscription**: no paid ranking, no paid
recommendation quality, no paywall on any other surface, ever. Quality, security, privacy and
reliability are never traded for cost (doctrine invariants unchanged).

## Researched cost facts (2026-07, list prices; hypotheses until measured on our images)

### Rendering (per successful render)

| Provider / model                | Price       | Notes                                                                           |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| FASHN direct API                | $0.075      | Adapter already built (licensed lane, commit cca5871); volume tiers approach $0.04 |
| Kling Kolors v1.5 (fal)         | $0.07       | Commercially usable via fal                                                      |
| FASHN v1.5 (via fal)            | $0.075      | Same model, fal billing                                                          |
| Leffa (fal)                     | $0.10       | Adapter already built; fal states commercial try-on OK                           |

- A complete outfit (top+bottom) may need **two sequential passes** → ~$0.14–0.15/outfit at list.
  Whether one pass suffices per garment class is **measured in F9**, not assumed.
- At ≈₹88/$: single render ≈ **₹6.2–8.8**; two-pass outfit ≈ **₹12.3–13.2**.
- Failed/abstained renders must not consume user quota; provider retries are bounded (contract F8).
- Own-it-later (self-host permissive architecture on brand on-model photos, doctrine D3/D4) is the
  long-term cost floor; a ~$0.50–0.70/hr GPU doing ~100+ renders/hr implies <$0.01/render, but this
  is a **hypothesis until a measured bake-off** and is gated behind F9/F12 evidence.

### Payment rail (India-first)

- **Stripe India is invite-only** for new merchants and card-only (no UPI). Not viable now.
- **Razorpay Subscriptions** is the default rail: ~2% payment fee + 0.99% subscription feature fee,
  +18% GST **on the fees** → effective ≈ **3.5%** of gross. No setup/AMC; pay only on success.
- **UPI Autopay / e-mandate** (RBI framework 2026): recurring debits under **₹15,000 without
  per-charge OTP**, 24h pre-debit alert, user can pause/cancel anytime. All our price points fit.
- **GST on sales**: 18% applies to digital services once the owner's registration threshold
  (₹20L aggregate services turnover) is crossed or registration is voluntary. **Owner decision;
  the plan models both.** Displayed prices are GST-inclusive if registered.
- Merchant-of-record platforms (Paddle etc.) are deferred until non-India demand exists; they take
  ~5%+ and add no value for UPI-first India.

## Unit economics (proposal — owner sets final prices)

Assume Razorpay effective fee 3.5%; render cost ₹6.6 (FASHN $0.075) per garment pass; outfit ≈ 2
passes ≈ ₹13.2. If GST-registered, divide net by 1.18 first.

| Tier                | Price/mo | Net (no GST reg.) | Net (GST reg.) | Outfit quota | GPU cost @quota | Margin (no reg. / reg.) |
| ------------------- | -------- | ----------------- | -------------- | ------------ | --------------- | ----------------------- |
| Trial (once, free)  | ₹0       | —                 | —              | 2 outfits    | ₹26             | acquisition cost        |
| Standard            | ₹199     | ₹192              | ₹163           | 10 outfits   | ₹132            | ₹60 / ₹31               |
| Plus                | ₹499     | ₹482              | ₹408           | 30 outfits   | ₹396            | ₹86 / ₹12               |

Rules the tiers must obey (these are the invariants; the numbers above are tunable):

1. **Quota × measured per-outfit cost ≤ 70% of net revenue** at promotion time, re-checked monthly
   from reconciled provider invoices (F12). If measurement beats list price (volume tiers,
   one-pass outfits), quotas expand — price never rises silently.
2. Unused quota does not roll over (cost ceiling stays hard); renders that fail don't count.
3. The global **cost kill switch** and per-user quotas from F8 stay, now protecting margin as well
   as budget. Paying users hitting the kill switch get quota restored + status page honesty.
4. One quality lane. Subscribers never get a cheaper/worse model than the promoted one; there is
   no "premium quality" upsell (quality and security are not price levers — contract F9).

## What ships, in contract order

Numbers refer to the amended execution contract. Nothing here jumps the F1–F7 queue.

- **F8 — Durable try-on behind subscription.** Everything F8 already required (private Postgres
  jobs, bounded retries, cancellation, TTL deletion, quotas, kill switch) **plus** the billing
  spine:
  - Razorpay Subscriptions integration behind a `BillingProvider` port (doctrine D1) — plan
    creation, checkout, webhook consumer (signature-verified, idempotent, replay-safe), mandate
    lifecycle (created/charged/paused/halted/cancelled).
  - An `entitlements` table keyed by `user_id`: active plan, period end, outfit quota, used count.
    The try-on endpoint checks entitlement + quota **server-side**; UI state is never the gate.
  - Free trial issuance (one per account, server-enforced) so conversion is measurable.
  - Cancellation, pause and refund paths tested; deleting the account cancels the mandate and
    erases billing PII beyond legally retained invoice fields (F2 machinery reused).
  - Web: pricing page, subscribe/cancel management in `/account`, quota meter on the try-on
    surface, honest empty state when unsubscribed (no dark patterns; the stylist feed never nags).
- **F9 — Provider evaluation (unchanged) is the go-live gate for charging.** Subscriptions open
  for purchase only after a provider/model passes the frozen consented scorecard. Selling renders
  from an unevaluated model is a false user-facing claim and fails the phase gate. Sequencing:
  build billing in F8 (testable in Razorpay test mode end-to-end), flip sales on when F9 promotes.
- **F11 — Beta** adds billing journeys to the mission-critical set: subscribe, render to quota,
  hit quota, cancel, refund, mandate pause, webhook outage recovery.
- **F12 — Reinvestment loop.** Monthly: reconcile provider invoices against metered renders and
  Razorpay settlements; publish margin; owner reallocates margin (catalog growth, own-it-later
  training, quota expansion). Quota/price changes only from this reconciled evidence.
- **F13 — unchanged.** Deletion still last; the cancelled *generic* payment plans stay deleted —
  what exists is only this scoped subscription.

## Security & trust requirements (non-negotiable, F8 DoD)

- Webhook endpoint verifies Razorpay signatures, is idempotent per event id, and never trusts
  client-reported payment state; entitlement changes originate from verified webhooks or
  server-side API polls only.
- No card/UPI data touches GYF servers (Razorpay Checkout hosted fields only). Keys live in
  Render/Vercel env, never in the repo.
- Rate-limited, authenticated billing endpoints; entitlement checks inside the same transaction
  that increments quota usage (no TOCTOU double-spend of renders).
- Honest surfaces: price incl. taxes, quota remaining, renewal date, one-click cancel, RBI 24h
  pre-debit alerts arrive from the rail. Status page reflects kill-switch state.
- 4-hour job TTL, consented photo storage and erasure exactly as F8/F2 already specify — paying
  does not weaken privacy.

## GPU hosting ladder (owner ask 2026-07-14: 10,000 users, lowest cost, zero idle spend, scalable)

Sizing assumption (tunable, re-checked monthly from real metering): 10,000 registered users,
~5% subscribed = 500 subscribers × 10 outfits × 2 garment passes ≈ **10,000 renders/month**, plus
bounded one-time trials. At ≈₹88/$, 500 × ₹199 ≈ ₹99,500 ≈ **$1,130/mo gross**.

**Stage 0 — no GPU server at all (now, and correct up to ~30–50k renders/mo).**
Per-render API (FASHN $0.075). 10k renders = **$750/mo**, zero idle cost, zero ops, scales to
zero by definition, covered by subscription revenue. Volume tiers push toward $0.04 (→ $400/mo).
The web/API/DB tier at 10k users stays on the current stack (Render + Supabase + Vercel),
≈ $25–50/mo — GPUs are the only meaningful cost.

**Stage 1 — serverless scale-to-zero GPU (the "GPU server" decision).**
Pick: **RunPod Serverless flex workers, L40S at $0.99/hr** (per-second billing, workers scale to
zero between requests; alternative: Modal L40S ≈ $1.95/hr with $30/mo free credit — better DX,
~2× dearer; both fine, RunPod is the cost pick). At ~20s/render:
10,000 renders × 20s ≈ 56 GPU-hours ≈ **$55–75/mo including cold starts** — roughly **10× cheaper
than the API** at the same volume, still $0 when nobody renders.
Trigger to move: monthly API bill exceeds ~$400–500 **and** a commercially-clean self-hostable
try-on model exists (today's open weights are non-commercial — this is the actual blocker, not
infrastructure). Keep model weights in a network volume to cut cold starts; the `TryOnRenderer`
port means the app doesn't change, only the adapter.

**Stage 2 — dedicated GPU, only when utilization says so.**
A 24/7 L40S (~$700/mo on-demand, less on community/commit pricing) beats serverless only above
~40–50% utilization ≈ **>120–150k renders/mo** (≈6,000+ subscribers). Decide then from reconciled
invoices, never up front.

Standing rules: every stage scales to zero or is justified by measured utilization; the F8 kill
switch caps spend at every stage; encoder/embedding work stays on the free lane (ZeroGPU/CPU
trickle); no reserved instances or commitments before Stage 2 evidence.

## Explicitly out of scope

Paid ranking or placement; charging for any non-try-on surface; multiple quality lanes; crypto or
international rails; annual plans and coupons (add from F12 evidence if conversion data asks for
them); merchant-of-record migration.

## Sources

- [FASHN developer API pricing update](https://fashn.ai/blog/pricing-update-for-developer-api) ·
  [FASHN API tiers](https://help.fashn.ai/plans-and-pricing/api-pricing)
- [fal.ai Kling Kolors v1.5](https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on) ·
  [fal.ai Leffa try-on](https://fal.ai/models/fal-ai/leffa/virtual-tryon) ·
  [fal.ai FASHN v1.5](https://fal.ai/models/fal-ai/fashn/tryon/v1.5)
- [Razorpay pricing explained](https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/) ·
  [Razorpay charges 2026 breakdown](https://www.softwaresuggest.com/blog/razorpay-payment-gateway-charges/)
- [Stripe: accounts invite-only in India](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india) ·
  [Stripe India FAQ](https://support.stripe.com/questions/india-faq)
- [RBI Digital Payments E-Mandate Framework 2026 compliance checklist](https://amlegals.com/upi-autopay-and-recurring-payments-compliance-checklist-under-rbis-e-mandate-framework-2026/) ·
  [Razorpay UPI Autopay guide](https://razorpay.com/blog/master-recurring-payments-upi-autopay-guide/)
