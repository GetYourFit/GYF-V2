import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import type { EstimatedField } from "@/lib/estimate";

import { PhotoUpload } from "./photo-upload";

const uploadPhoto = vi.fn();
const putConsent = vi.fn().mockResolvedValue({ data_processing: true });
vi.mock("@/lib/api-client", () => ({ browserApi: () => ({ uploadPhoto, putConsent }) }));

beforeAll(() => {
  // jsdom has no object-URL support; the component only needs it not to throw.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

function pickFile(type: string, size = 1000) {
  const input = screen.getByLabelText(/choose a photo/i, { selector: "input" });
  const file = new File([new Uint8Array(size)], "me.png", { type });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe("PhotoUpload", () => {
  it("rejects a non-image file with a clear message", () => {
    render(<PhotoUpload onEstimated={vi.fn()} />);
    pickFile("application/pdf");
    expect(screen.getByRole("alert")).toHaveTextContent(/jpeg, png, or webp/i);
  });

  it("rejects an oversized image", () => {
    render(<PhotoUpload onEstimated={vi.fn()} />);
    pickFile("image/png", 11 * 1024 * 1024);
    expect(screen.getByRole("alert")).toHaveTextContent(/over 10 mb/i);
  });

  it("estimates and reports the merged profile on success", async () => {
    uploadPhoto.mockResolvedValueOnce({ body_type: "hourglass", source: "photo" });
    // onEstimated returns the human labels actually adopted plus any fields the
    // photo module couldn't produce; the component reads both to compose the
    // status message.
    const onEstimated = vi.fn(() => ({ applied: ["body type"], missing: [] as EstimatedField[] }));
    render(<PhotoUpload onEstimated={onEstimated} />);
    pickFile("image/png");
    fireEvent.click(screen.getByRole("button", { name: /estimate from photo/i }));
    await waitFor(() =>
      expect(onEstimated).toHaveBeenCalledWith({
        body_type: "hourglass",
        source: "photo",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/estimated/i);
  });

  it("names the specific field it couldn't read on a partial estimate", async () => {
    uploadPhoto.mockResolvedValueOnce({ skin_tone: "mst5", source: "photo" });
    const onEstimated = vi.fn(() => ({
      applied: ["skin tone"],
      missing: ["body_type"] as EstimatedField[],
    }));
    render(<PhotoUpload onEstimated={onEstimated} />);
    pickFile("image/png");
    fireEvent.click(screen.getByRole("button", { name: /estimate from photo/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/body type/i));
    expect(screen.getByRole("status")).toHaveTextContent(/set it manually/i);
  });

  it("degrades honestly when the photo modules are unavailable (503)", async () => {
    uploadPhoto.mockRejectedValueOnce(new ApiError(503, "unavailable"));
    render(<PhotoUpload onEstimated={vi.fn()} />);
    pickFile("image/png");
    fireEvent.click(screen.getByRole("button", { name: /estimate from photo/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/isn’t available right now/i),
    );
  });
});
