import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SplashScreen } from "./splash-screen";

describe("SplashScreen once-per-session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows the loading splash on the first visit of a session", () => {
    render(<SplashScreen />);
    expect(screen.getByRole("status", { name: /loading gyf/i })).toBeTruthy();
  });

  it("does not block once the splash has been shown this session", async () => {
    sessionStorage.setItem("gyf_splash_shown", "1");
    // It MUST render on the first pass (matching SSR markup — a client render
    // that skips it is the hydration mismatch that orphaned the splash div at
    // z-index 9999 and blanked the whole app), then dismiss right after mount.
    render(<SplashScreen />);
    await waitFor(
      () => expect(screen.queryByRole("status", { name: /loading gyf/i })).toBeNull(),
      { timeout: 2000 },
    );
  });
});
