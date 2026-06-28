"""HTTP route groups, one module per product surface.

Each module exposes an ``APIRouter`` that ``app.main`` includes. Routes stay thin
— validation + orchestration only — and pull their repositories/adapters through
the shared providers in ``app.dependencies`` so tests can swap in-memory doubles.
"""
