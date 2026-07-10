import { render, screen } from "@testing-library/react";
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

  it("does not block once the splash has been shown this session", () => {
    sessionStorage.setItem("gyf_splash_shown", "1");
    render(<SplashScreen />);
    expect(screen.queryByRole("status", { name: /loading gyf/i })).toBeNull();
  });
});
