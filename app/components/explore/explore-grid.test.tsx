import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@gyf/types";
import { ExploreGrid } from "./explore-grid";
import type { ExploreFilters } from "./filter-bar";

const search = vi.fn();
const browse = vi.fn();
const getProfile = vi.fn();
const listSaved = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({ search, browse, getProfile, listSaved }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const FILTERS: ExploreFilters = {
  q: "",
  slot: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
};

function hit(id: string): SearchResult {
  return { item_id: id, title: id, score: 1 };
}

beforeEach(() => {
  search.mockReset();
  browse.mockReset();
  getProfile.mockReset();
  getProfile.mockResolvedValue({ gender: "unknown" });
  sessionStorage.clear();
  // jsdom has no IntersectionObserver; the grid's infinite-scroll sentinel only
  // needs the constructor to exist, not to actually fire.
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
});

describe("ExploreGrid default browse", () => {
  it("uses the cheap /browse feed (no ML embed) for the empty default view", async () => {
    browse.mockResolvedValueOnce([hit("a"), hit("b")]);

    render(<ExploreGrid filters={FILTERS} />);

    // No query/slot/price/sort → the empty state must hit browse, never search
    // (which would pay a multi-second SigLIP embed for a non-query).
    await waitFor(() => expect(browse).toHaveBeenCalledTimes(1));
    expect(search).not.toHaveBeenCalled();
    const [params] = browse.mock.calls[0];
    expect(params.slots).toBe("top,bottom,full_body,footwear");
    expect(params.slot).toBeUndefined();

    await screen.findByText("a");
  });

  it("uses a plain slot filter (not slots) when a search query is present", async () => {
    search.mockResolvedValueOnce([hit("a")]);

    render(<ExploreGrid filters={{ ...FILTERS, q: "red dress" }} />);

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    const [, params] = search.mock.calls[0];
    expect(params.slots).toBeUndefined();
  });
});
