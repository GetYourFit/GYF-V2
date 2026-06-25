"""Vendored subset of gyf_contracts.usermodel for the GPU Space.

The Space runs the real skin-tone pipeline (usermodel.skintone, copied into this
repo) which only needs these two sentinels. Kept in lockstep with the canonical
packages/contracts/gyf_contracts/usermodel.py in the GYF monorepo.
"""

from __future__ import annotations

UNKNOWN_SKIN_TONE = "unknown"
UNKNOWN_UNDERTONE = "unknown"
