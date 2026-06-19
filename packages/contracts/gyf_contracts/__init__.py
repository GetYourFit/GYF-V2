"""GYF shared domain contracts.

The single source of truth for vocabularies that both the product surface
(``gyf-api``) and the ML platform (``gyf-ml``) must agree on. Keeping these here
lets the two services evolve independently while still speaking the same
language — e.g. perception predicts the *same* canonical garment categories the
catalog normalizes feed text into, so vision and feed signals reconcile cleanly.
"""
