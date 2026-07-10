import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@gyf/types";
import { CanvasExplorer } from "./canvas-explorer";

const getProfile = vi.fn();
const browse = vi.fn();
const similar = vi.fn();

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({ getProfile, browse, similar }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/layout/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/explore/item-detail-sheet", () => ({ ItemDetailSheet: () => null }));

function hit(id: string, color = "navy"): SearchResult {
  return { item_id: id, title: id, score: 1, color, image_url: null };
}

const CHROME_LABELS = new Set(["Back", "Zoom in", "Zoom out"]);

/** Every currently-rendered catalog tile (skeletons are plain divs, not
 *  buttons; chrome buttons — back/zoom — aren't catalog tiles either). */
function tileButtons() {
  return screen
    .getAllByRole("button")
    .filter((b) => !CHROME_LABELS.has(b.getAttribute("aria-label") ?? ""));
}

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ gender: "unknown" });
  browse.mockReset();
  similar.mockReset();
  // jsdom doesn't implement the Pointer Events capture API the surface's
  // pan handler relies on.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  // fireEvent dispatches pointermove events back-to-back with ~0ms of real
  // elapsed time, which the component's velocity calc (dx / dt, dt clamped
  // to a 1ms floor) reads as an absurd flick — momentum then flings `pan`
  // hundreds of thousands of px away over the following rAF frames, which
  // is a synthetic-event artifact, not anything a real drag produces.
  // Stubbing rAF to never fire keeps the pan exactly where the deliberate
  // pointermove deltas below put it.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CanvasExplorer recluster", () => {
  it("repopulates the grid after a click, even after panning away from center first", async () => {
    // Initial browse: 60 items, enough to pan across. Not `...Once`: the
    // pan below may cross the infinite-scroll load-more margin and fire a
    // second `browse()` call, which would otherwise resolve `undefined`
    // and throw inside loadMore (silently caught, but noisy/misleading).
    const initial = Array.from({ length: 60 }, (_, i) => hit(`browse-${i}`));
    browse.mockResolvedValue(initial);
    // Recluster pool for whichever tile gets clicked.
    const pool = Array.from({ length: 24 }, (_, i) => hit(`similar-${i}`));

    render(<CanvasExplorer />);

    await waitFor(() => expect(tileButtons().length).toBeGreaterThan(0));

    // Pan the canvas far from its resting position — this is the state that
    // exposed the stale-cull-box bug: a recluster recenters `pan` back to
    // {0,0}, and if the viewport-culling window doesn't also snap back to
    // origin, the freshly laid-out tiles (which sit near the plane origin)
    // fall outside the stale window and never render.
    const surface = screen.getByRole("region", { name: /canvas explorer/i });
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 800, clientY: 800 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 500, clientY: 500 });

    // Sanity check on the pan itself, isolated from the click/recluster:
    // the loaded cluster spans roughly ±2000px from origin, so a 300px pan
    // must not already have wiped out every tile on its own.
    const afterPan = tileButtons();
    expect(afterPan.length).toBeGreaterThan(0);

    similar.mockResolvedValueOnce(pool);
    const target = afterPan[0];
    // A real tap is pointerdown -> pointerup -> click; the pan above left
    // wasDragRef pinned true, which onTileClick checks to ignore clicks at
    // the end of a drag. A still (no-movement) pointer sequence on the
    // target tile clears it before the click event fires.
    fireEvent.pointerDown(target, { pointerId: 2, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 400, clientY: 400 });
    fireEvent.click(target);

    // The click is deferred (single/double-click arbitration) before
    // selectItem() even fires.
    await waitFor(() => expect(similar).toHaveBeenCalled(), { timeout: 1000 });

    // The recluster must actually repaint tiles, not just update the
    // background — this is the "grid not forming" regression.
    await waitFor(
      () => {
        const buttons = tileButtons();
        expect(buttons.length).toBeGreaterThan(1);
      },
      { timeout: 1000 },
    );
  });

  it("keeps reclustering on a second click inside the just-formed cluster", async () => {
    const initial = Array.from({ length: 60 }, (_, i) => hit(`browse-${i}`));
    browse.mockResolvedValue(initial);
    const poolA = Array.from({ length: 24 }, (_, i) => hit(`similar-a-${i}`));
    const poolB = Array.from({ length: 24 }, (_, i) => hit(`similar-b-${i}`));

    render(<CanvasExplorer />);
    await waitFor(() => expect(tileButtons().length).toBeGreaterThan(0));

    // First recluster.
    similar.mockResolvedValueOnce(poolA);
    let target = tileButtons()[0];
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 400, clientY: 400 });
    fireEvent.click(target);
    await waitFor(() => expect(similar).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await waitFor(
      () => {
        expect(
          tileButtons().some((b) => b.getAttribute("aria-label")?.startsWith("similar-a")),
        ).toBe(true);
      },
      { timeout: 1000 },
    );

    // Second recluster, on a tile from the FIRST recluster's result.
    similar.mockResolvedValueOnce(poolB);
    target = tileButtons().find((b) => b.getAttribute("aria-label")?.startsWith("similar-a"))!;
    fireEvent.pointerDown(target, { pointerId: 2, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 400, clientY: 400 });
    fireEvent.click(target);
    await waitFor(() => expect(similar).toHaveBeenCalledTimes(2), { timeout: 1000 });

    await waitFor(
      () => {
        const labels = tileButtons()
          .map((b) => b.getAttribute("aria-label"))
          .filter(Boolean);
        expect(labels.some((l) => l?.startsWith("similar-b"))).toBe(true);
      },
      { timeout: 1000 },
    );
  });
});
