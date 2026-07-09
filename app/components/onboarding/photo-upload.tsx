"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, CheckCircle } from "lucide-react";

import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import { FIELD_LABELS, type EstimatedField } from "@/lib/estimate";
import type { Profile } from "@gyf/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface PhotoUploadProps {
  onEstimated: (profile: Profile) => { applied: string[]; missing: EstimatedField[] };
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
  const [missingFields, setMissingFields] = useState<EstimatedField[]>([]);
  const [missed, setMissed] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Revoke the object URL when the component unmounts (e.g. the wizard navigates
  // to another step and remounts this) — otherwise each preview blob leaks for the
  // rest of the session. selectFile handles the replace-while-mounted case.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(next: File | null) {
    setError(null);
    setDone(false);
    setEstimated([]);
    setMissingFields([]);
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
      const { applied, missing } = onEstimated(profile);
      setEstimated(applied);
      setMissingFields(missing);
      setMissed(applied.length === 0);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.isUnavailable) {
        setError("Photo onboarding isn’t available right now — please use the form below.");
      } else if (e instanceof ApiError && e.status === 403) {
        setError('Please accept "Process my data" consent below, then try again.');
      } else {
        setError(e instanceof Error ? e.message : "Could not read that photo. Try another.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Header */}
      <div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--secondary)",
            marginBottom: "0.375rem",
          }}
        >
          Estimate from photo
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            lineHeight: 1.55,
            color: "var(--text-faint)",
          }}
        >
          Upload a clear, well-lit photo. GYF estimates your skin tone and body type — edit anything
          it gets wrong. Image is not stored.
        </p>
      </div>

      {/* Drop zone */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          selectFile(e.dataTransfer.files?.[0] ?? null);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: previewUrl ? "0" : "2rem 1rem",
          background: dragActive ? "var(--surface-2)" : "var(--rule)",
          border: `1px dashed ${dragActive ? "var(--secondary)" : "var(--border)"}`,
          cursor: "pointer",
          transition: "all 0.2s",
          textAlign: "center",
          minHeight: previewUrl ? "auto" : "140px",
          overflow: "hidden",
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected photo preview"
            style={{ maxHeight: "180px", objectFit: "contain", display: "block", width: "100%" }}
          />
        ) : (
          <>
            <UploadCloud size={28} aria-hidden style={{ color: "var(--text-mid)" }} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "var(--text-faint)",
              }}
            >
              <span style={{ color: "var(--text-mid)" }}>Choose a photo</span> or drag it here
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.55rem",
                color: "var(--text-mid)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              JPEG · PNG · WebP · max 10 MB
            </span>
          </>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          // No `capture` — that forces the camera on mobile. Omitting it lets the OS
          // picker offer BOTH gallery and camera, so a saved photo can be uploaded.
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {/* Status messages */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--error)",
              margin: 0,
            }}
          >
            {error}
          </motion.p>
        )}
        {done && !missed && (
          <motion.p
            key="done"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--success)",
              margin: 0,
            }}
          >
            <CheckCircle size={14} aria-hidden />
            {missingFields.length === 0
              ? `Estimated ${estimated.join(" & ")} — review and edit below.`
              : `Estimated ${estimated.join(" & ")} — couldn't read ${missingFields.map((f) => FIELD_LABELS[f]).join(" & ")} from this photo, set it manually below.`}
          </motion.p>
        )}
        {done && missed && (
          <motion.p
            key="missed"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--text-faint)",
              margin: 0,
            }}
          >
            Couldn’t read your features — try a clearer front-facing photo, or set fields below
            manually.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <motion.button
          type="button"
          disabled={!file || busy}
          aria-busy={busy}
          onClick={onUpload}
          whileTap={busy ? undefined : { scale: 0.97 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            height: "40px",
            padding: "0 1rem",
            background: file && !busy ? "var(--primary)" : "var(--rule)",
            color: file && !busy ? "var(--bg)" : "var(--text-faint)",
            border: "none",
            borderRadius: "999px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: !file || busy ? "not-allowed" : "pointer",
            opacity: !file || busy ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {busy ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Analysing…
            </motion.span>
          ) : (
            "Estimate from photo"
          )}
        </motion.button>

        {file && (
          <button
            type="button"
            onClick={() => selectFile(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "transparent",
              border: "none",
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              minHeight: "40px",
              padding: "0 0.25rem",
            }}
          >
            <X size={12} aria-hidden />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
