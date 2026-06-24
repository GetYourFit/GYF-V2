"""GYF user-modeling ML modules: body-type and skin-tone estimation from a photo.

Each submodule keeps its heavy model behind a lazy-loaded estimator and a pure,
weightless logic core (measurements/colour science + classification) so the
orchestration and the API adapters are testable without downloading any weights.
"""
