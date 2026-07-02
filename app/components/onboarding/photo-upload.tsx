"use client";

import { useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, CheckCircle } from "lucide-react";

import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Profile } from "@gyf/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface PhotoUploadProps {
  onEstimated: (profile: Profile) => string[];
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
  const [dragActive, setDragActive] = useState(false);

  function selectFile(next: File | null) {
    setError(null);
    setDone(false);
    setEstimated([]);
    setMissed(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!next) { setFile(null); setPreviewUrl(null); return; }
    if (!ACCEPTED.includes(next.type)) {
      setFile(null); setPreviewUrl(null);
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null); setPreviewUrl(null);
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
      const applied = onEstimated(profile);
      setEstimated(applied);
      setMissed(applied.length === 0);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.isUnavailable) {
        setError("Photo onboarding isn't available right now — please use the form below.");
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
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#f0bd8f",
          marginBottom: "0.375rem",
        }}>
          Estimate from photo
        </p>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8125rem",
          lineHeight: 1.55,
          color: "#5a5a65",
        }}>
          Upload a clear, well-lit photo. GYF estimates your skin tone and body type — edit anything it gets wrong. Image is not stored.
        </p>
      </div>

      {/* Drop zone */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); selectFile(e.dataTransfer.files?.[0] ?? null); }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: previewUrl ? "0" : "2rem 1rem",
          background: dragActive ? "rgba(240,189,143,0.04)" : "rgba(255,255,255,0.02)",
          border: `1px dashed ${dragActive ? "#f0bd8f" : "rgba(255,255,255,0.12)"}`,
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
            <UploadCloud size={28} aria-hidden style={{ color: "#444748" }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#5a5a65" }}>
              <span style={{ color: "#c4c7c8" }}>Choose a photo</span> or drag it here
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "#444748",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              JPEG · PNG · WebP · max 10 MB
            </span>
          </>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
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
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#ffb4ab", margin: 0 }}
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
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#10B981", margin: 0 }}
          >
            <CheckCircle size={14} aria-hidden />
            Estimated {estimated.join(" & ")} — review and edit below.
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
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#8e9192", margin: 0 }}
          >
            Couldn't read your features — try a clearer front-facing photo, or set fields below manually.
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
            background: file && !busy ? "#ffffff" : "rgba(255,255,255,0.06)",
            color: file && !busy ? "#000000" : "#5a5a65",
            border: "none",
            borderRadius: "2px",
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
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              Analysing…
            </motion.span>
          ) : "Estimate from photo"}
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
              color: "#5a5a65",
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
