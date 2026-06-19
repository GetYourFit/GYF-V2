"""Catalog ingestion — normalize external product feeds into the ``items`` table.

The API service owns the ``items`` schema, so feed ingestion (taxonomy
normalization, region/culture tagging, dedupe, upsert) lives here. Perception
(embeddings + attributes) is a separate concern in the ``ml`` package.
"""
