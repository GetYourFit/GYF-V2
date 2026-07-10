import "@testing-library/jest-dom/vitest";

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@gyf/types";
import { ExploreCard } from "./explore-card";

function hit(id: string): SearchResult {
  return { item_id: id, title: id, score: 1, image_url: null };
}

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  // This jsdom has no PointerEvent constructor at all, so fireEvent.pointerDown
  // et al. silently drop clientX/clientY (and any other MouseEventInit field) —
  // PointerEvent extends MouseEvent, which jsdom does support with those fields.
  if (typeof window.PointerEvent === "undefined") {
    class FakePointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? "touch";
      }
    }
    // @ts-expect-error -- test-only polyfill, not a full PointerEvent
    window.PointerEvent = FakePointerEvent;
  }
  // jsdom has no real layout engine, so a pill measured via
  // getBoundingClientRect always reports 0-width/height at 0,0 — stub it to
  // a plausible on-screen box so the "is the pointer over the pill" hit test
  // has something real to check against.
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 90,
    right: 110,
    top: 90,
    bottom: 110,
    width: 20,
    height: 20,
    x: 90,
    y: 90,
    toJSON() {},
  }));
});

describe("ExploreCard long-press-to-save", () => {
  it("saves when the press is held then dragged onto the pill", async () => {
    const onSave = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <ExploreCard item={hit("a")} index={0} saved={false} onSave={onSave} onSelect={onSelect} />,
    );
    const card = container.querySelector("article")!;

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 200 });
    // Long-press fires after LONG_PRESS_MS (450ms) of holding still — the
    // resulting setPill() is a real state update outside any fireEvent call,
    // so it must be wrapped in act() itself.
    await act(() => new Promise((r) => setTimeout(r, 500)));
    // Drag onto the pill's (stubbed) bounds.
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 100, clientY: 100 });

    expect(onSave).toHaveBeenCalledWith(hit("a"));
    // The long-press-drag is not a tap — it must not also open the detail sheet.
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a plain tap still opens the detail sheet, no save", async () => {
    const onSave = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <ExploreCard item={hit("b")} index={0} saved={false} onSave={onSave} onSelect={onSelect} />,
    );
    const card = container.querySelector("article")!;

    fireEvent.pointerDown(card, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.click(card);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(hit("b")));
    expect(onSave).not.toHaveBeenCalled();
  });
});
