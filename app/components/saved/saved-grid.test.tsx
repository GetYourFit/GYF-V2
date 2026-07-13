import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedOutfit } from "@gyf/types";
import { SavedGrid } from "./saved-grid";

const removeSavedOutfit = vi.fn();
const feedback = vi.fn().mockResolvedValue(undefined);
const toast = vi.fn();

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({
    listSavedOutfits: vi.fn().mockResolvedValue([LOOK]),
    listSaved: vi.fn().mockResolvedValue([]),
    removeSavedOutfit,
    feedback,
  }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/saved/saved-card", () => ({
  SavedCard: ({ onRemove }: { onRemove: () => void }) => (
    <button type="button" onClick={onRemove}>
      Remove saved look
    </button>
  ),
}));

const LOOK: SavedOutfit = {
  id: "look-1",
  outfit_key: "look-key",
  recommendation_id: "rec-1",
  items: [
    { item_id: "top-1", title: "Top", category: "tops", slot: "top" },
    { item_id: "bottom-1", title: "Bottom", category: "bottoms", slot: "bottom" },
  ],
};

beforeEach(() => {
  removeSavedOutfit.mockReset();
  feedback.mockClear();
  toast.mockClear();
});

describe("SavedGrid look removal feedback", () => {
  it("emits per-item skips only after deletion succeeds", async () => {
    let resolveDelete!: () => void;
    removeSavedOutfit.mockReturnValue(new Promise<void>((resolve) => (resolveDelete = resolve)));
    render(<SavedGrid />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove saved look" }));
    expect(feedback).not.toHaveBeenCalled();

    resolveDelete();
    await waitFor(() => expect(feedback).toHaveBeenCalledTimes(2));
    expect(feedback.mock.calls.map(([event]) => event.target_id)).toEqual(["top-1", "bottom-1"]);
    expect(feedback.mock.calls.every(([event]) => event.action === "skip")).toBe(true);
  });

  it("never emits skips when deletion fails and the look is restored", async () => {
    removeSavedOutfit.mockRejectedValue(new Error("delete failed"));
    render(<SavedGrid />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove saved look" }));

    await screen.findByRole("button", { name: "Remove saved look" });
    expect(feedback).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({ title: "Couldn't remove that look", variant: "error" });
  });
});
