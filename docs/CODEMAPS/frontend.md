<!-- Generated: 2026-06-27 | Next.js App Router (Bun) | ~450 tokens -->
# Frontend (app/)

## Page tree
```
(auth)/login, (auth)/signup     → components/auth/auth-form.tsx   FUNCTIONAL (email/pw; no OAuth/reset)
(app)/page.tsx  (Stylist feed)  → stylist/stylist-feed.tsx        FUNCTIONAL (recommend + feedback)
(app)/onboarding                → onboarding/onboarding-wizard    FUNCTIONAL (profile/consent/photo)
(app)/explore                   → explore/explore-grid            PARTIAL  (fake price; broken pagination → W5)
(app)/saved                     → saved/saved-grid                PARTIAL  (localStorage only → server-back W4/W5)
(app)/wardrobe                  → wardrobe/wardrobe-grid          MOCKED   (no API → build W4/W5)
(app)/social                    → social/social-feed (MOCK_POSTS) MOCKED   (no API → build W4/W5)
/profile                        → MISSING route (nav dead-links)  → build W5
api/health/route.ts             → health proxy                    FUNCTIONAL
```

## Auth / guard
`proxy.ts` → `lib/supabase/middleware.ts` → `lib/supabase/verify-jwt.ts` (local WebCrypto ES256;
`aud==authenticated` enforced — H-2 fixed). `(app)` group is gated; `(auth)` public.

## API access
Single client: `lib/api.ts` → `lib/api-client.ts` (binds Supabase JWT). Local stores (to be
replaced by real endpoints): `lib/saved-store.ts`, `components/wardrobe/wardrobe-store.ts`.

## Design system
Tokens in `globals.css` ↔ `tailwind.config.ts` (black/white industrial); Framer Motion
(`[0.16,1,0.3,1]` easing). **Gap:** no Radix — `components/ui/` hand-rolled; native `<select>`
(WCAG 2.2 target → adopt Radix in W5). Nav: `bottom-nav.tsx` (live), `app-shell.tsx`.
