this is a idea doc for the frontend build for the GYF app 

USE THE ECC FOLDER FOR ALL THE DESIGN AND DEVELOPMENT USAGE.

phase 1 should consist of optimising the app for mobile view and usage, followed by design changes 
i.e add animation to the intro page using the added logo image in the project folder 

phase 2 will work on the overall modification of the app , following the updated design language i.e more interactiveness , jakarta sans font to be used throughout , no outdated or generic design should be followed 

Develop a final markdown file named as Complete.md which will consist of all the execution plan for the development of the APP 

The app should be industrial grade and deployable for multi user usage.

---
purpose: Fashion E-Commerce AI Design System Directive
target_agents: [Claude Code, Claude Design]
version: 1.0.0
---

# Fashion App System Specification & Visual Vibe

## 1. Visual Theme & Brand Persona
*   **Core Aesthetic**: High-end luxury editorial, bold minimalist, image-first presentation.
*   **Vibe Checklist**: Premium feel, generous whitespace, asymmetrical elements, elegant scaling.
*   **Keywords**: Sophisticated, editorial typography, seamless transitions, immersive product grids.

## 2. Color Palette (Tokens & Intent)
### Light Mode (Primary Default)
*   `--bg-primary`: `#FFFFFF` (Main page canvas, maximizes white space)
*   `--bg-secondary`: `#F8F8F8` (Soft cream background for category filters and product cards)
*   `--text-primary`: `#111111` (Rich deep charcoal for high-contrast typography)
*   `--text-secondary`: `#767676` (Muted labels, price variations, sizing indicators)
*   `--accent`: `#000000` (Classic bold luxury black for primary CTA buttons)

### Dark Mode (Alternative Night Shopping Experience)
*   `--bg-primary`: `#0B0B0B` (Sleek deep onyx canvas)
*   `--bg-secondary`: `#161616` (Elevated product cards and container borders)
*   `--text-primary`: `#F5F5F5` (Crisp bone white text)
*   `--text-secondary`: `#9E9E9E` (Subdued details)
*   `--accent`: `#FFFFFF` (High-contrast white for interactive targets)

## 3. Typography & Hierarchy (Editorial Focus)
*   `--font-display`: "Playfair Display", "Didot", serif (For collection headers, large hero statements)
*   `--font-sans`: "Plus Jakarta Sans", "Helvetica Neue", sans-serif (For readable product names, UI details)
*   `--text-xs`: `0.70rem / 1rem` (Letter-spaced tracking for category badges)
*   `--text-sm`: `0.85rem / 1.25rem` (Regular interface typography, pricing structure)
*   `--text-base`: `1rem / 1.6rem` (Product descriptions, editorial paragraphs)
*   `--text-lg`: `1.5rem / 2rem` (Product titles, swipe-deck catalog categories)
*   `--text-xl`: `2.25rem / 2.75rem` (Hero promotional displays, trend board titles)

## 4. Spacing, Borders & Grids
*   `--spacing-unit`: `8px` responsive scaling baseline.
*   `--space-sm`: `8px` (Spacing between text descriptors and prices)
*   `--space-md`: `16px` (Default interface margins, list item isolation blocks)
*   `--space-lg`: `32px` (Generous vertical spacing separating collections)
*   `--border-radius`: `0px` or max `2px` (Strictly sharp or micro-rounded layouts to preserve luxury identity)

## 5. Component Styling Rules
### Product Showcase Cards
*   **Media Container**: Forced `3:4` or `4:5` vertical aspect ratio. Images must crop to center without distortion.
*   **Overlay**: Transparent gradient at base for floating text blocks if applicable. No boxes or borders around individual images.

### Buttons & Interactive Controls
*   **Add-To-Cart CTA**: Solid background (`--accent`), full width on mobile, tracking-wide typography.
*   **Selector Tags (Sizes/Colors)**: Clean outlined wireframe borders when unselected; filled block color when selected.

## 6. Layout & Multi-Column Principles
*   **Feed Structure**: Alternating 2-column uniform grids and full-width bold visual layout rows.
*   **Navigation Matrix**: Persistent minimal top sticky header with absolute zero drop-shadow clutter.

## 7. Interaction & Motion Guidance
*   **Transitions**: Immersive layout shifts (`250ms cubic-bezier(0.16, 1, 0.3, 1)`).
*   **Micro-interactions**: Product images expand slightly (`scale(1.03)`) on user hover states.

## 8. UX Anti-Patterns (Do's & Don'ts)
*   ✅ **DO**: Rely heavily on high-quality full-bleed photography, allow elements breathing room, use stark monochrome tones.
*   ❌ **DON'T**: Do not use primary colors for notification badges, do not stack content with heavy borders, avoid playful round shapes.

## 9. Claude Prompt Directive (System Instructions)
> "When rendering or generating layout configurations for this fashion application, prioritize the image aspect ratios and editorial typography rules detailed above. Always favor layout whitespace over structural borders or container cards. Cross-check output against Section 8 before committing code."


I have added the logo with no background use it , I dont want any whiteish background on the logo that is showing on the app.