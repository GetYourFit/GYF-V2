"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Profile } from "@gyf/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

interface PhotoUploadProps {
  onEstimated: (profile: Profile) => void;
}

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
      const api = browserApi();
      await api.putConsent({ flags: { data_processing: true } });
      const profile = await api.uploadPhoto(file);
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
        setError("Photo onboarding isn't available right now — please use the form below.");
      } else if (e instanceof ApiError && e.status === 403) {
        setError("Please accept "Process my data" consent below, then try again.");
      } else {
        setError(e instanceof Error ? e.message : "Could not read that photo. Try another.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border border-dashed border-[var(--border-mid)] bg-[var(--surface-2)] p-5">
      <div>
        <p className="t-label text-[var(--text)]">Estimate from a photo</p>
        <p className="t-caption mt-1">
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
        className="flex cursor-pointer flex-col items-center gap-3 border border-[var(--border-mid)] bg-[var(--surface)] px-4 py-8 text-center transition-colors duration-[180ms] hover:border-[var(--border-hi)]"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="max-h-48 object-contain"
          />
        ) : (
          <span className="t-body text-[var(--text-faint)]">
            <span className="text-[var(--text)]">Choose a photo</span> or drag it here
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
        <p role="alert" className="t-caption text-[var(--error)]">
          {error}
        </p>
      )}
      {done && !missed && (
        <p role="status" className="t-caption text-[var(--accent-warm)]">
          Estimated {estimated.join(" & ")} — review and edit below, then save.
        </p>
      )}
      {done && missed && (
        <p role="status" className="t-caption text-[var(--text-mid)]">
          Couldn't read your features from this photo — try a clearer, well-lit, front-facing
          photo, or just set the fields below manually.
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!file || busy}
          aria-busy={busy}
          onClick={onUpload}
        >
          {busy ? "Analysing…" : "Estimate from photo"}
        </Button>
        {file && (
          <button
            type="button"
            className="t-caption text-[var(--text-faint)] underline underline-offset-4 hover:text-[var(--text)] hover:no-underline transition-colors"
            onClick={() => selectFile(null)}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
