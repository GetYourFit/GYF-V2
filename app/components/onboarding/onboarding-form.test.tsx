import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

import { OnboardingForm } from "./onboarding-form";

const getProfile = vi.fn();
const getConsent = vi.fn();
const uploadPhoto = vi.fn();
const putConsent = vi.fn().mockResolvedValue({ data_processing: true });
const putProfile = vi.fn().mockResolvedValue({});

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({ getProfile, getConsent, uploadPhoto, putConsent, putProfile }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  // First-time user: no profile yet, empty consent.
  getProfile.mockRejectedValue(new ApiError(404, "not onboarded"));
  getConsent.mockResolvedValue({});
});

describe("OnboardingForm photo estimate", () => {
  it("fills the skin tone + undertone selects from the estimated profile", async () => {
    // Exactly what the live API returns for a real photo.
    uploadPhoto.mockResolvedValueOnce({
      skin_tone: "mst8",
      undertone: "neutral",
      body_type: null,
      measurements: {},
      style_intent: [],
      budget_range: null,
      occasion: null,
      source: "photo",
      field_confidence: { skin_tone: 0.2211, undertone: 0.2565 },
      model_version: "retinaface-farl-celebm-cielab-mst-v1",
    });

    render(<OnboardingForm />);
    // Wait for the initial profile load to settle (form leaves the loading state).
    await screen.findByLabelText(/skin tone/i);

    const input = screen.getByLabelText(/choose a photo/i, { selector: "input" });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(1000)], "me.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /estimate from photo/i }));

    const skin = screen.getByLabelText(/skin tone/i) as HTMLSelectElement;
    const undertone = screen.getByLabelText(/undertone/i) as HTMLSelectElement;
    await waitFor(() => expect(skin.value).toBe("mst8"));
    expect(undertone.value).toBe("neutral");
  });
});
