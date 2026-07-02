"use client";

// Virtual try-on (M9): "See it on you" inside the outfit detail sheet. The
// user picks a photo; the API renders the designed look on their body via the
// licensed rendering lane and answers with the doctrine's honest trio — the
// render (or an abstention + reason), a calibrated confidence, and exactly
// which garments made it onto the body. The photo is ephemeral end-to-end.

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

import { browserApi } from "@/lib/api-client";
import type { Outfit, TryOnResponse } from "@gyf/types";

export function TryOnSection({ outfit }: { outfit: Outfit }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TryOnResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A new outfit invalidates the previous render (render-time state adjustment
  // — the React-docs pattern for derived resets, no effect, no extra commit).
  const outfitKey = outfit.items.map((i) => i.item_id).join(",");
  const [prevKey, setPrevKey] = useState(outfitKey);
  if (prevKey !== outfitKey) {
    setPrevKey(outfitKey);
    setResult(null);
    setError(null);
  }

  const renderSrc = result?.image_b64 ? `data:image/png;base64,${result.image_b64}` : null;

  async function onPick(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await browserApi().tryOn(
        file,
        outfit.items.map((i) => i.item_id),
      );
      setResult(r);
      if (!r.image_b64) setError(r.reason || "Try-on could not render this look.");
    } catch {
      setError("Try-on is unavailable right now — the look above is still yours.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "#9a9490",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        See it on you
      </span>

      {result && renderSrc && (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={renderSrc}
            alt="This outfit rendered on your photo"
            style={{ width: "100%", display: "block", borderRadius: "2px" }}
          />
          <figcaption
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "#9a9490",
              letterSpacing: "0.06em",
              marginTop: "0.375rem",
            }}
          >
            AI render · {Math.round(result.confidence * 100)}% confidence · shows{" "}
            {result.rendered_slots.join(" + ")}
            {result.reason ? ` · ${result.reason}` : ""}
          </figcaption>
        </figure>
      )}

      {error && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "#a04545",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          minHeight: "44px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "transparent",
          color: busy ? "#5c5650" : "#9a9490",
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: busy ? "wait" : "pointer",
          borderRadius: "999px",
        }}
      >
        <Camera size={14} aria-hidden />
        {busy
          ? "Rendering your look…"
          : result?.image_b64
            ? "Try another photo"
            : "Upload a photo to try it on"}
      </button>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.6875rem",
          color: "#9a9490",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Your photo is used only for this render and never stored.
      </p>
    </div>
  );
}
