import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SearchResult } from "@gyf/types";

import { CompatibilityPanel } from "./compatibility-panel";

const item = (score: number): SearchResult => ({
  item_id: "item-1",
  title: "Linen shirt",
  score,
  image_url: null,
});

describe("CompatibilityPanel confidence labels", () => {
  it("does not call an unscored browse placeholder a confidence judgment", () => {
    render(<CompatibilityPanel item={item(0)} />);

    expect(screen.getByText(/not yet scored/i)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows the confidence label when a real score exists", () => {
    render(<CompatibilityPanel item={item(0.8)} />);

    expect(screen.getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "80");
  });
});
