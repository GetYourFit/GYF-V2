# QoL & UX Program — intuitive, engaging, psychologically-grounded GYF

> Compiled 2026-07-03. Scope: the live web surface (stylist feed, Explore,
> collections/saved, wardrobe, social, profile, onboarding, account).
> Ordering inside each section = impact per unit effort, highest first.
> Rule zero (the mission constraint): **every feature below must make the core
> loop — get a look you trust, act on it — faster or more trustworthy. Anything
> that only adds delight without serving that loop is cut.**

## 1. The psychology map (why each mechanic works)

| Principle | What it means for GYF |
| --- | --- |
| **Doherty threshold** (<400ms response) | Perceived speed beats real speed: optimistic UI, skeletons, prefetch. Slow = "dumb", fast = "intelligent" — users literally rate the same recs as smarter when they arrive faster. |
| **Labor illusion** | When the system *is* doing real work (composing outfits), show it: "matching against your warm undertone… checking budget…" staged progress beats an instant-but-opaque spinner. Only for real work — never fake it (D6 honesty). |
| **Endowed progress / goal gradient** | Progress bars people start pre-filled move faster to completion. Onboarding: "2 of 6 — already 33% styled". Profile completeness meter drives photo upload + wardrobe adds. |
| **Variable reward** (the ethical slice) | The feed refresh should occasionally surface a "bold pick" outside the user's comfort zone, labeled as such. Novelty is the reward; labeling keeps it honest and gathers exploration signal. |
| **IKEA effect** | Looks the user co-creates (swap one piece, anchor on their wardrobe) are valued more and bought more. "Swap this piece" is a conversion feature, not a toy. |
| **Peak-end rule** | End every session on a high: after feedback, show the sharpened next rec ("Got it — here's a better one") rather than a dead toast. |
| **Loss aversion** | "3 looks expiring from your feed" is dark-pattern adjacent — skip it. The honest version: price-drop and back-in-stock alerts on *saved* items (real loss, real signal). |
| **Recognition over recall** | Never make users re-state context. Occasion, budget, goals persist visibly as editable chips above the feed — always one tap from change. |
| **Hick's law** | Fewer, better choices. 5 diverse outfits beat 30 items. Explore facets collapse to the 3 the user actually uses (learned per user). |
| **Jakob's law** | Borrow muscle memory: double-tap = save, edge-swipe = back, pull-down = refresh, long-press = preview. Zero learning cost. |
| **Von Restorff** | One visually distinct card per feed page (the "stylist's pick of the day") gets outsized attention — use it for the highest-confidence look. |
| **Zeigarnik effect** | Unfinished tasks nag pleasantly: "Your wardrobe has 4 items — add shoes and I can style full looks from your closet" as a dismissible inline card. |

## 2. Gesture & navigation (native-feel on mobile web)

1. **Swipe right/left on outfit cards = save / not-interested** — mirrors the
   existing feedback buttons, 10× faster, multiplies flywheel signal volume.
   Undo toast on every destructive swipe (reversal is already a product rule).
2. **Scroll restoration** on back-navigation into infinite feeds (feed, Explore,
   social). The single most common hidden frustration in gallery apps.
3. **Detail views as slide-over layers** (parallel routes) — swipe-down or
   edge-swipe dismisses; the feed stays alive underneath. Back gesture never
   loses state.
4. **Pull-to-refresh** at feed top; after profile/feedback changes show a
   "New looks ready" pill instead of silently restacking under the user.
5. **Bottom sheet** for occasion/filters on mobile, draggable, swipe-dismiss.
6. **Double-tap image = save**, **long-press = quick actions** (save to
   collection / hide / share).
7. **Desktop keyboard**: j/k traverse, s save, x skip, / focuses search, esc
   closes layers.

## 3. Perceived performance (the Doherty budget)

1. **Optimistic UI everywhere** state flips locally (save, react, follow,
   wardrobe add), rollback+toast on failure.
2. **Skeletons shaped like the real cards** with shimmer; no spinners.
3. **Blur-up image placeholders using the item's stored dominant CIELAB color**
   — a GYF-unique touch: the grid pre-paints in the palette of the clothes.
4. **Prefetch on intent**: hover/press-start prefetches detail data; next feed
   page prefetches at 70% scroll.
5. **Stale-while-revalidate** on feed/Explore so returning to a tab is instant,
   then quietly freshens.

## 4. The intelligent-stylist feel (trust + engagement)

1. **Reactive feedback loop made visible**: after "not interested", the
   replacement card animates in with a one-line delta ("Less oversized — noted").
   Peak-end + proves learning is real.
2. **"Why this" progressive disclosure**: confidence chip + one-line reason on
   the card; tap → full explanation (undertone/body/budget sentences already
   shipped). Never a wall of text up front.
3. **Swap-a-piece on any outfit** (IKEA effect): tap a slot → 3 alternates that
   keep the look coherent. Every swap is a compatibility training example.
4. **Stylist's pick of the day** (Von Restorff): one distinct card, highest
   confidence, refreshed daily — gives a reason to return without streak
   mechanics.
5. **Bold pick, labeled** (ethical variable reward): occasional out-of-comfort
   card marked "A stretch for you — trust me?" with save/skip capturing
   exploration appetite.
6. **Context chips above the feed** (recognition over recall): occasion,
   budget, active NL goal as editable pills; feed re-composes on change with
   the labor-illusion progress line.

## 5. Onboarding & habit formation (honest versions only)

1. **Endowed progress bar** starting at step "1 done" (account created).
2. **Value before work**: show 3 cold-start looks *immediately* after gender +
   occasion, then ask for more (photo, budget) framed as "sharpen these".
   Never a long form before the first wow.
3. **Profile completeness meter** with the *reason* each field helps ("add skin
   tone → color-matched palettes"), not a naked percentage.
4. **Zeigarnik wardrobe nudge**: inline card when the closet is styleable-but-
   incomplete.
5. **Price-drop / back-in-stock notification on saved items** — the honest
   loss-aversion play, and a real return trigger. (Needs the nightly ingest
   diffing prices — data already re-ingested nightly.)
6. **No streaks, no fake urgency, no confirm-shaming.** Trust is the product;
   dark patterns are debt against it.

## 6. Micro-interactions & feel

1. Haptics (`navigator.vibrate`) on save/react where supported.
2. Spring physics on card enter/exit (Framer Motion already in stack); respect
   `prefers-reduced-motion`.
3. Save animation: item flies to the Saved tab icon with a badge count bump
   (spatial memory of where things went).
4. Empty states that *do something*: empty saved → "3 looks people with your
   taste saved this week"; empty wardrobe → camera CTA.
5. Draft persistence: half-typed NL goal, selected filters survive reload.
6. Share cards rendered as branded outfit collages (og-image route) — social
   loop with zero extra user effort.

## 7. Robustness & efficiency floor (functional before fun)

1. **Contrast/visibility audit** — feedback-v4's white-on-white buttons are a
   trust killer; run an automated axe/contrast pass in CI on the design tokens.
2. **Offline/flaky-network grace**: queued mutations with retry (saves made on
   the metro must not vanish); "you're offline" pill, never a dead white page.
3. **Error boundaries per surface** with retry buttons — one broken card never
   kills the feed (the social-page blank in v4 is exactly this failure class).
4. **Session-restore auth**: silent token refresh; never bounce a mid-scroll
   user to login.
5. **Bundle discipline**: route-level code splitting, defer social/profile
   chunks; LCP budget ≤2.5s on 4G mid-range Android (the actual Indian beta
   device class).
6. **Instrument every mechanic above as events** — swipes, swaps, bold-pick
   responses are all taste signal; QoL features double as flywheel intake.

## 7.5 Researched additions (2026 sweep)

1. **View Transitions API** for route/layer changes — now broadly supported;
   near-free native-feel page morphs (Next.js supports it via
   `experimental.viewTransition`). Falls back gracefully.
2. **`overscroll-behavior-y: contain`** + custom pull-to-refresh — disables the
   browser's own reload gesture so ours owns the interaction.
3. **Visual search** ("shoot a garment → find matches") — we already embed with
   SigLIP; a camera button on Explore that runs image→vector search is a small
   surface over existing retrieval, and it *is* the wardrobe photo path reused.
4. **Weather/context-aware feed conditioning** — "26°C in Mumbai today" chip
   conditioning the feed (open-meteo, free). Research shows weather+calendar
   outfit planning is a top retention driver for stylist apps; it kills daily
   decision fatigue, which is literally GYF's mission statement.
5. **Back-in-stock + price-drop alerts** on saved items (confirmed as the
   highest-converting automated flow in fashion m-commerce).
6. **Standalone PWA shell** — manifest + service worker so "install GYF" gives
   full-screen, no browser chrome, offline shell; the cheapest "we have an app"
   move ($0, no store).
7. **W2 shipped (2026-07-03):** session cache lib (`lib/session-cache.ts`),
   stale-while-revalidate stylist feed (instant repaint on tab return, quiet
   refresh only while user is still at top — no silent restack), Explore
   back-nav restore (items + page + scroll position), 600px infinite-scroll
   prefetch lookahead, offline pill in the app shell. 2026 sweep re-confirmed
   the thesis: skeletons > spinners, felt-speed = perceived intelligence,
   micro-interactions as trust signals are table stakes.
8. **First-minutes rule** — retention studies: users decide within the first
   session. The onboarding wave (§5.2 value-before-work) is therefore W2-adjacent,
   not W4; pull the 3-instant-looks change forward.

## 8. Sequencing (build order)

| Wave | Items | Why first |
| --- | --- | --- |
| **W1 — floor** ✅ 2026-07-03 | §7.1–7.4 (contrast, error boundaries, offline grace, auth restore) | Feedback-v4 bugs; trust floor before delight. |
| **W2 — core loop speed** ✅ 2026-07-03 | §2.1–2.4 (swipes, scroll restore, layers, refresh) + §3 all | Fastest visible transformation; grows signal volume. |
| **W3 — stylist feel** | §4.1–4.4 (reactive delta, why-this, swap-a-piece, daily pick) | Directly answers "it feels dumb" in v4. |
| **W4 — habit & onboarding** | §5 + §6 | Retention layer once the loop is worth returning to. |

Each wave runs the standard loop: rubric → build → gan-design eval →
specialist review (react-reviewer + a11y) → gate → ship.
