# GYF profitability evidence report

Period: **2026-06-28 → 2026-07-27** (30 days).

**Data source: none.** `GYF_DATABASE_URL` was not configured in this execution environment, so no query ran against the `interactions` spine. Every count below is honestly zero because no data was observed, not because zero conversions occurred in production — re-run this script with `GYF_DATABASE_URL` set against the production/Supabase database to get a real reading for this period.

## 1. Conversion rate — outbound shop clicks → Cuelinks-confirmed conversions

- Outbound shop clicks (`action='cart'`): **0**
- Confirmed conversions (`action='purchase'`, non-reversed): **0**
- Reversed/cancelled conversions (excluded from the rate): **0**
- Conversion rate: **insufficient data (denominator is zero)**

## 2. Repeat-use rate

Definition: of users active on a core engagement action (save/skip/swap/cart/tryon) in the period, the fraction active on a second distinct calendar day within the same period. Approximates the plan's D1/D7/D30 repeat-save/correction/wardrobe-decision definition (docs/plans/gyf-launch-refactor-plan.md); wardrobe-item edits are not yet joined into `interactions`, so this is a lower bound.

- Active users in period: **0**
- Repeat-active users (2+ distinct days): **0**
- Repeat-use rate: **insufficient data (denominator is zero)**

## 3. Contribution-margin estimate (parameterized)

Formula (correct the moment real inputs replace the placeholders below):

```
estimated_commission_inr = confirmed_sale_amount_inr * commission_rate
hosting_cost_allocation_inr = hosting_cost_month_inr * period_days / 30
contribution_margin_estimate_inr = estimated_commission_inr - hosting_cost_allocation_inr
```

- Confirmed sale amount (INR, summed from `context.sale_amount`): **0.00**
- Reversed sale amount (INR, excluded above): **0.00**
- Commission rate: **5.00%** (PLACEHOLDER default (5%, illustrative — see gyf-launch-refactor-plan.md))
- Estimated commission (INR): **0.00**
- Actual reported commission from Cuelinks `context.commission`, when present (INR): **insufficient data**
- Hosting-cost allocation for the period (INR): **3000.00** (PLACEHOLDER default (₹3,000/month — the NFR-3 hosting+GPU ceiling, not an actual allocation), prorated from a monthly figure of 3000.00)
- **Contribution-margin estimate (INR): -3000.00**

## Status note for the captain (not a blocker)

The commission rate and hosting-cost allocation above are placeholder defaults (see `GYF_COMMISSION_RATE_PLACEHOLDER` / `GYF_HOSTING_COST_ALLOCATION_INR_PLACEHOLDER` in `main()`), not the merchant's actual contracted commission rate or GYF's actual per-period hosting-cost allocation. The captain must supply the exact commission-rate and cost-allocation inputs before this contribution-margin number can be treated as a real business figure rather than an illustrative estimate.
