import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import type { Outfit, TryOnJob } from "@gyf/types";

import { TryOnSection } from "./try-on-section";

const createTryOnJob = vi.fn();
const tryOnJob = vi.fn();
const cancelTryOnJob = vi.fn();
const systemStatus = vi.fn();

vi.mock("@/lib/api-client", () => ({
  browserApi: () => ({ createTryOnJob, tryOnJob, cancelTryOnJob, systemStatus }),
}));

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  systemStatus.mockResolvedValue({ capabilities: { virtual_try_on: { status: "live" } } });
});

afterEach(() => vi.useRealTimers());

const OUTFIT = {
  items: [{ item_id: "top-1" }, { item_id: "bottom-1" }],
} as unknown as Outfit;

const JOB: TryOnJob = {
  job_id: "j1",
  status: "queued",
  item_ids: ["top-1", "bottom-1"],
  image_url: null,
  confidence: null,
  model_version: null,
  rendered_slots: [],
  reason: "",
  error_code: null,
  attempts: 0,
  created_at: "2026-07-15T00:00:00Z",
  finished_at: null,
  expires_at: "2026-07-16T00:00:00Z",
};

// The first poll lands at 2s (the real schedule); the default 1s findBy timeout would
// give up before it. Wait for the real thing rather than faking the clock.
const POLLED = { timeout: 6000 };

function pickPhoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(10)], "me.png", { type: "image/png" })] },
  });
}

describe("TryOnSection", () => {
  it("never asks for a photo when the capability is not live", async () => {
    // The F9 gate: try-on is closed, so the UI must not solicit a body photo.
    systemStatus.mockResolvedValue({ capabilities: { virtual_try_on: { status: "planned" } } });
    render(<TryOnSection outfit={OUTFIT} />);

    expect(await screen.findByText(/isn't available here yet/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("fails CLOSED when the status fetch errors", async () => {
    // A transient /system/status blip must never be the reason GYF asks for a body photo.
    systemStatus.mockRejectedValue(new Error("network"));
    render(<TryOnSection outfit={OUTFIT} />);

    expect(await screen.findByText(/isn't available here yet/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("queues a job and polls it through to the render", async () => {
    createTryOnJob.mockResolvedValue({ job_id: "j1", status: "queued" });
    tryOnJob.mockResolvedValueOnce({ ...JOB, status: "running" }).mockResolvedValueOnce({
      ...JOB,
      status: "succeeded",
      image_url: "/tryon/jobs/j1/image",
      confidence: 0.72,
      rendered_slots: ["top", "bottom"],
    });

    render(<TryOnSection outfit={OUTFIT} />);
    await screen.findByText(/upload a photo/i);
    pickPhoto();

    expect(await screen.findByText(/in the render queue/i)).toBeInTheDocument();
    expect(await screen.findByText(/rendering your look/i, {}, POLLED)).toBeInTheDocument();

    const img = await screen.findByAltText(/rendered on your photo/i, {}, POLLED);
    expect(img).toHaveAttribute("src", expect.stringContaining("/tryon/jobs/j1/image"));
    expect(screen.getByText(/72% confidence/)).toBeInTheDocument();
    expect(screen.getByText(/top \+ bottom/)).toBeInTheDocument();
  });

  it("shows an abstention as a reason and NEVER as an image", async () => {
    // Doctrine D6: the renderer declined. The surface must not imply a render exists.
    createTryOnJob.mockResolvedValue({ job_id: "j1", status: "queued" });
    tryOnJob.mockResolvedValue({
      ...JOB,
      status: "abstained",
      reason: "Could not find a clear, front-facing pose.",
    });

    render(<TryOnSection outfit={OUTFIT} />);
    await screen.findByText(/upload a photo/i);
    pickPhoto();

    expect(await screen.findByText(/clear, front-facing pose/i, {}, POLLED)).toBeInTheDocument();
    expect(screen.queryByAltText(/rendered on your photo/i)).toBeNull();
  });

  it("reports an exhausted quota without offering anything to buy", async () => {
    createTryOnJob.mockRejectedValue(new ApiError(429, "quota"));

    render(<TryOnSection outfit={OUTFIT} />);
    await screen.findByText(/upload a photo/i);
    pickPhoto();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/free renders this month/i);
    // Everything is free: a quota message must never route to a paywall.
    expect(alert.textContent?.toLowerCase()).not.toMatch(/upgrade|subscribe|buy|pro\b/);
  });

  it("cancels a queued render", async () => {
    createTryOnJob.mockResolvedValue({ job_id: "j1", status: "queued" });
    tryOnJob.mockResolvedValue({ ...JOB, status: "queued" });
    cancelTryOnJob.mockResolvedValue({ ...JOB, status: "cancelled" });

    render(<TryOnSection outfit={OUTFIT} />);
    await screen.findByText(/upload a photo/i);
    pickPhoto();

    fireEvent.click(await screen.findByText(/cancel render/i));

    await waitFor(() => expect(cancelTryOnJob).toHaveBeenCalledWith("j1"));
    expect(await screen.findByText(/nothing was rendered/i)).toBeInTheDocument();
  });

  it("stops polling on unmount but does NOT cancel the durable job", async () => {
    createTryOnJob.mockResolvedValue({ job_id: "j1", status: "queued" });
    tryOnJob.mockResolvedValue({ ...JOB, status: "running" });

    const { unmount } = render(<TryOnSection outfit={OUTFIT} />);
    await screen.findByText(/upload a photo/i);
    pickPhoto();
    await screen.findByText(/in the render queue|rendering your look/i);

    unmount();
    const callsAtUnmount = tryOnJob.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));

    expect(tryOnJob.mock.calls.length).toBe(callsAtUnmount);
    // The render is durable and the quota is already spent — closing the sheet must not
    // throw the render away.
    expect(cancelTryOnJob).not.toHaveBeenCalled();
  });
});
