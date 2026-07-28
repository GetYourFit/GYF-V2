from __future__ import annotations

from datetime import date
import unittest

import report_profitability as rp


def _row(action: str, ts: str, *, user="u1", context=None):
    return {
        "user_id": user,
        "target_type": "item",
        "target_id": "i1",
        "action": action,
        "context": context or {},
        "ts": ts,
    }


class ConversionMetricsTests(unittest.TestCase):
    def test_no_clicks_is_insufficient_data_not_zero_rate(self):
        metrics = rp.compute_conversion_metrics([])
        self.assertEqual(metrics.outbound_clicks, 0)
        self.assertIsNone(metrics.conversion_rate)

    def test_confirmed_purchase_counts_reversed_does_not(self):
        rows = [
            _row("cart", "2026-07-01T10:00:00+00:00"),
            _row("cart", "2026-07-02T10:00:00+00:00"),
            _row("purchase", "2026-07-01T11:00:00+00:00", context={"status": "confirmed"}),
            _row("purchase", "2026-07-03T11:00:00+00:00", context={"status": "reversed"}),
        ]
        metrics = rp.compute_conversion_metrics(rows)
        self.assertEqual(metrics.outbound_clicks, 2)
        self.assertEqual(metrics.confirmed_conversions, 1)
        self.assertEqual(metrics.reversed_conversions, 1)
        self.assertAlmostEqual(metrics.conversion_rate, 0.5)

    def test_purchase_with_no_status_counts_as_confirmed(self):
        rows = [
            _row("cart", "2026-07-01T10:00:00+00:00"),
            _row("purchase", "2026-07-01T11:00:00+00:00"),
        ]
        metrics = rp.compute_conversion_metrics(rows)
        self.assertEqual(metrics.confirmed_conversions, 1)


class RepeatUseMetricsTests(unittest.TestCase):
    def test_no_active_users_is_insufficient_data(self):
        metrics = rp.compute_repeat_use_metrics([])
        self.assertEqual(metrics.active_users, 0)
        self.assertIsNone(metrics.repeat_use_rate)

    def test_single_day_user_is_not_repeat(self):
        rows = [_row("save", "2026-07-01T10:00:00+00:00", user="u1")]
        metrics = rp.compute_repeat_use_metrics(rows)
        self.assertEqual(metrics.active_users, 1)
        self.assertEqual(metrics.repeat_users, 0)
        self.assertEqual(metrics.repeat_use_rate, 0.0)

    def test_two_distinct_days_makes_a_repeat_user(self):
        rows = [
            _row("save", "2026-07-01T10:00:00+00:00", user="u1"),
            _row("skip", "2026-07-05T10:00:00+00:00", user="u1"),
            _row("cart", "2026-07-01T10:00:00+00:00", user="u2"),
        ]
        metrics = rp.compute_repeat_use_metrics(rows)
        self.assertEqual(metrics.active_users, 2)
        self.assertEqual(metrics.repeat_users, 1)
        self.assertAlmostEqual(metrics.repeat_use_rate, 0.5)

    def test_same_day_twice_is_not_a_repeat(self):
        rows = [
            _row("save", "2026-07-01T10:00:00+00:00", user="u1"),
            _row("skip", "2026-07-01T18:00:00+00:00", user="u1"),
        ]
        metrics = rp.compute_repeat_use_metrics(rows)
        self.assertEqual(metrics.repeat_users, 0)

    def test_impression_and_purchase_are_not_core_engagement(self):
        rows = [
            _row("impression", "2026-07-01T10:00:00+00:00", user="u1"),
            _row("purchase", "2026-07-05T10:00:00+00:00", user="u1"),
        ]
        metrics = rp.compute_repeat_use_metrics(rows)
        self.assertEqual(metrics.active_users, 0)


class ContributionMarginTests(unittest.TestCase):
    def test_formula_with_known_inputs(self):
        rows = [
            _row(
                "purchase",
                "2026-07-01T11:00:00+00:00",
                context={"status": "confirmed", "sale_amount": "1000", "commission": "40"},
            ),
            _row(
                "purchase",
                "2026-07-02T11:00:00+00:00",
                context={"status": "reversed", "sale_amount": "500", "commission": "20"},
            ),
        ]
        margin = rp.compute_contribution_margin(
            rows,
            period_days=30,
            commission_rate=0.05,
            commission_rate_source="test",
            hosting_cost_month_inr=3000.0,
            hosting_cost_source="test",
        )
        self.assertAlmostEqual(margin.confirmed_sale_amount_inr, 1000.0)
        self.assertAlmostEqual(margin.reversed_sale_amount_inr, 500.0)
        self.assertAlmostEqual(margin.actual_reported_commission_inr, 40.0)
        self.assertAlmostEqual(margin.estimated_commission_inr, 50.0)
        self.assertAlmostEqual(margin.hosting_cost_allocation_inr, 3000.0)
        self.assertAlmostEqual(margin.contribution_margin_estimate_inr, -2950.0)

    def test_no_purchases_yields_zero_estimate_not_fabricated(self):
        margin = rp.compute_contribution_margin(
            [],
            period_days=30,
            commission_rate=0.05,
            commission_rate_source="test",
            hosting_cost_month_inr=3000.0,
            hosting_cost_source="test",
        )
        self.assertEqual(margin.confirmed_sale_amount_inr, 0)
        self.assertIsNone(margin.actual_reported_commission_inr)
        self.assertEqual(margin.estimated_commission_inr, 0)

    def test_hosting_cost_prorates_by_period_length(self):
        margin = rp.compute_contribution_margin(
            [],
            period_days=15,
            commission_rate=0.05,
            commission_rate_source="test",
            hosting_cost_month_inr=3000.0,
            hosting_cost_source="test",
        )
        self.assertAlmostEqual(margin.hosting_cost_allocation_inr, 1500.0)


class BuildReportTests(unittest.TestCase):
    def test_empty_period_reports_insufficient_data_honestly(self):
        conversion = rp.compute_conversion_metrics([])
        repeat_use = rp.compute_repeat_use_metrics([])
        margin = rp.compute_contribution_margin(
            [],
            period_days=30,
            commission_rate=0.05,
            commission_rate_source="PLACEHOLDER default",
            hosting_cost_month_inr=3000.0,
            hosting_cost_source="PLACEHOLDER default",
        )
        report = rp.build_report(
            [],
            start=date(2026, 6, 28),
            end=date(2026, 7, 27),
            conversion=conversion,
            repeat_use=repeat_use,
            margin=margin,
            data_source_note="**Data source: none.**",
        )
        self.assertIn("insufficient data", report)
        self.assertNotIn("NaN", report)
        self.assertIn("Status note for the captain", report)


if __name__ == "__main__":
    unittest.main()
