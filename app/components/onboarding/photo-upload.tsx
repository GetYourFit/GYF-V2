"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Profile } from "@gyf/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // mirrors GYF_MAX_PHOTO_BYTES (API default 10 MiB)

interface PhotoUploadProps {
  /** Called with the merged profile after a successful estimate, so the parent
   *  form can pre-fill the (always-editable) skin-tone / body-type fields. */
  onEstimated: (profile: Profile) => void;
}

/** Photo onboarding path: upload one photo → the API estimates skin tone + body
 *  type and returns the merged profile. Estimated fields land in the form below as
 *  editable values ("we estimated this — fix if wrong"). Degrades honestly: a 503
 *  means the photo modules aren't available, and the manual form is right there. */
export function PhotoUpload({ onEstimated }: PhotoUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [estimated, setEstimated] = useState<string[]>([]);
  const [missed, setMissed] = useState(false);

  function selectFile(next: File | null) {
    setError(null);
    setDone(false);
    setEstimated([]);
    setMissed(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!next) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!ACCEPTED.includes(next.type)) {
      setFile(null);
      setPreviewUrl(null);
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setPreviewUrl(null);
      setError("That image is over 10 MB — please choose a smaller one.");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Uploading a photo to be analysed IS the data-processing consent action.
      // Persist it first so the API (which checks the stored flag, not the form's
      // unsaved local state) doesn't 403 before the form is submitted.
      const api = browserApi();
      await api.putConsent({ flags: { data_processing: true } });
      const profile = await api.uploadPhoto(file);
      // Report exactly which fields the estimate filled, so an abstain (or a disabled
      // module) reads as honest feedback instead of a silent "Estimated" with empty fields.
      const filled: string[] = [];
      if (profile.skin_tone) filled.push("skin tone");
      if (profile.undertone) filled.push("undertone");
      if (profile.body_type) filled.push("body type");
      setEstimated(filled);
      setMissed(filled.length === 0);
      setDone(true);
      onEstimated(profile);
    } catch (e) {
      if (e instanceof ApiError && e.isUnavailable) {
        setError("Photo onboarding isn’t available right now — please use the form below.");
      } else if (e instanceof ApiError && e.status === 403) {
        setError("Please accept “Process my data” consent below, then try again.");
      } else {
        setError(e instanceof Error ? e.message : "Could not read that photo. Try another.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
      <div>
        <p className="text-sm font-medium text-neutral-800">📷 Estimate from a photo</p>
        <p className="text-xs text-neutral-500">
          Upload one clear, well-lit photo and GYF will estimate your skin tone and body type —
          you can edit anything it gets wrong. The image is processed privately and not stored.
        </p>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          selectFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600 hover:border-neutral-400"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="max-h-48 rounded object-contain"
          />
        ) : (
          <span>
            <span className="font-medium text-neutral-800">Choose a photo</span> or drag it here
          </span>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {done && !missed && (
        <p role="status" className="text-xs font-medium text-green-700">
          Estimated {estimated.join(" & ")} — review and edit below, then save.
        </p>
      )}
      {done && missed && (
        <p role="status" className="text-xs font-medium text-amber-700">
          Couldn’t read your features from this photo — try a clearer, well-lit, front-facing
          photo, or just set the fields below manually.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!file || busy}
          aria-busy={busy}
          onClick={onUpload}
        >
          {busy ? "Analysing…" : "Estimate from photo"}
        </Button>
        {file && (
          <button
            type="button"
            className="text-xs text-neutral-500 underline"
            onClick={() => selectFile(null)}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
