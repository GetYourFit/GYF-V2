import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

import { OnboardingWizard } from "./onboarding-wizard";

const putProfile = vi.fn();
const getProfile = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({
    getProfile,
    getConsent: vi.fn().mockResolvedValue({ data_processing: true }),
    putProfile,
  }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/onboarding/photo-upload", () => ({ PhotoUpload: () => null }));

beforeEach(() => {
  putProfile.mockReset();
  getProfile.mockReset().mockRejectedValue(new ApiError(404, "No profile yet"));
});

it("cannot bypass the required gender by jumping steps or submitting the form", async () => {
  const { container } = render(<OnboardingWizard />);
  await screen.findByRole("heading", { name: "About you" });

  fireEvent.click(screen.getByRole("button", { name: /step 4: privacy/i }));
  expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();

  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/pick who/i));
  expect(putProfile).not.toHaveBeenCalled();
});

it("treats a legacy unknown gender as incomplete", async () => {
  getProfile.mockResolvedValueOnce({ gender: "unknown" });
  const { container } = render(<OnboardingWizard />);
  await screen.findByRole("heading", { name: "About you" });

  fireEvent.click(screen.getByRole("button", { name: /step 4: privacy/i }));
  fireEvent.submit(container.querySelector("form")!);

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/pick who/i));
  expect(putProfile).not.toHaveBeenCalled();
});
