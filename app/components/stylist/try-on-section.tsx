"use client";

// Virtual try-on (M9/F8): "See it on you" inside the outfit detail sheet.
//
// The render is a durable background job now, not a blocking call — so this component
// is a small state machine around a poll, and the user can close the sheet without
// losing the render. Three rules it exists to keep:
//
//   1. The user's own photo IS the waiting state. Not a spinner, not a skeleton over a
//      picture of their body. They can see it is still theirs, and still being worked on.
//   2. No invented progress. A percentage the server never sent is a lie, and this
//      product's whole thesis is that it does not tell them (doctrine D6). Honest stage
//      text instead.
//   3. Never imply a render that does not exist. An abstention shows their unchanged
//      photo and the renderer's reason — never a placeholder image.

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";

import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import { useCapabilityStrict } from "@/lib/use-capability";
import type { Outfit, TryOnJob } from "@gyf/types";

const TERMINAL = new Set(["succeeded", "abstained", "failed", "cancelled"]);

// Renders land in 10-60s. A flat 1s poll would be ~40 wasted round trips against a
// free-tier API that sleeps; this backs off and settles at 5s.
const POLL_SCHEDULE_MS = [2000, 2000, 3000, 5000];
const pollDelay = (tick: number) => POLL_SCHEDULE_MS[Math.min(tick, POLL_SCHEDULE_MS.length - 1)];

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.55rem",
  color: "var(--text-faint)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const BODY: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  color: "var(--text-faint)",
  margin: 0,
  lineHeight: 1.5,
};

export function TryOnSection({ outfit }: { outfit: Outfit }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capable = useCapabilityStrict("virtual_try_on");

  // A new outfit invalidates the previous render (render-time state adjustment — the
  // React-docs pattern for derived resets, no effect, no extra commit).
  const outfitKey = outfit.items.map((i) => i.item_id).join(",");
  const [prevKey, setPrevKey] = useState(outfitKey);
  if (prevKey !== outfitKey) {
    setPrevKey(outfitKey);
    setJob(null);
    setError(null);
    setPhotoUrl(null);
  }

  const jobId = job && !TERMINAL.has(job.status) ? job.job_id : null;

  // Poll while the job is live. Recursive setTimeout, not setInterval: a slow API must
  // not stack overlapping requests. Unmounting stops the poll but does NOT cancel the
  // job — the render is durable and the quota is already spent, so it keeps going and
  // is waiting when the user comes back.
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    const tick = (n: number) => {
      timer = setTimeout(async () => {
        if (!active) return;
        try {
          const next = await browserApi().tryOnJob(jobId, controller.signal);
          if (!active) return;
          setJob(next);
          if (!TERMINAL.has(next.status)) tick(n + 1);
        } catch (e) {
          if (!active || (e as Error).name === "AbortError") return;
          setError("GYF lost contact with the render. It may still be working — check back.");
        }
      }, pollDelay(n));
    };
    tick(0);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [jobId]);

  // The object URL is the user's body. Revoke it the moment it is replaced or the
  // component goes away — the browser must not hold it longer than the flow needs.
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  async function onPick(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setPhotoUrl(URL.createObjectURL(file));
    try {
      const created = await browserApi().createTryOnJob(
        file,
        outfit.items.map((i) => i.item_id),
      );
      setJob({ ...EMPTY_JOB, job_id: created.job_id, status: created.status });
    } catch (e) {
      setPhotoUrl(null);
      if (e instanceof ApiError && e.isQuotaExhausted) {
        // Free, but the GPU is finite. Never a paywall — nothing here is buyable.
        setError(
          "You've used all your free renders this month. They reset at the start of the next one.",
        );
      } else if (e instanceof ApiError && e.isUnavailable) {
        setError(
          "Try-on is paused right now to keep it free for everyone — the look above is still yours.",
        );
      } else {
        setError("Try-on is unavailable right now — the look above is still yours.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onCancel() {
    if (!job) return;
    try {
      setJob(await browserApi().cancelTryOnJob(job.job_id));
    } catch {
      setError("Could not cancel the render.");
    }
  }

  function discard() {
    setJob(null);
    setPhotoUrl(null);
    setError(null);
  }

  if (capable === false) {
    // Capability gate: no rendering lane has passed its evaluation gate on this
    // deployment — say so instead of collecting a photo that could never be rendered.
    return (
      <Section>
        <p style={BODY}>
          Virtual try-on isn&apos;t available here yet, so GYF doesn&apos;t ask for your photo. It
          arrives once a rendering lane passes its evaluation gate.
        </p>
      </Section>
    );
  }

  const pending = uploading || (job !== null && !TERMINAL.has(job.status));
  const rendered = job?.status === "succeeded" && job.image_url;

  return (
    <Section>
      {/* The photo is the canvas: dimmed while pending, restored on the outcome. An
          abstention leaves them looking at their own unchanged photo — nothing was
          taken, nothing was faked. */}
      {photoUrl && !rendered && (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Your uploaded photo"
            style={{
              width: "100%",
              display: "block",
              borderRadius: "2px",
              filter: pending ? "grayscale(1) brightness(0.55)" : "none",
              transition: "filter 0.4s var(--ease-lux)",
            }}
          />
        </figure>
      )}

      {rendered && job && (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_API_URL ?? ""}${job.image_url}`}
            alt={`The outfit rendered on your photo — showing ${job.rendered_slots.join(" and ")}`}
            style={{ width: "100%", display: "block", borderRadius: "2px" }}
          />
          <figcaption style={{ ...MONO, marginTop: "0.375rem", textTransform: "none" }}>
            AI render
            {job.confidence !== null && ` · ${Math.round(job.confidence * 100)}% confidence`} ·
            shows {job.rendered_slots.join(" + ")}
            {job.reason ? ` · ${job.reason}` : ""}
          </figcaption>
        </figure>
      )}

      {/* Honest status. No percentage, because the server does not send one. */}
      <p role="status" aria-live="polite" style={{ ...MONO, margin: 0 }}>
        {uploading && "Sending your photo…"}
        {!uploading && job?.status === "queued" && "In the render queue · you can close this"}
        {!uploading && job?.status === "running" && "Rendering your look…"}
      </p>

      {/* An abstention is not an error: no image, the renderer's real reason. */}
      {job?.status === "abstained" && (
        <p style={{ ...BODY, color: "var(--text-mid)" }}>
          {job.reason || "GYF couldn't dress this photo confidently, so it didn't guess."}
        </p>
      )}

      {(job?.status === "failed" || error) && (
        <p role="alert" style={{ ...BODY, color: "var(--error)" }}>
          {error ?? job?.reason}
        </p>
      )}

      {job?.status === "cancelled" && <p style={BODY}>Cancelled — nothing was rendered.</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      {pending ? (
        <PillButton onClick={onCancel}>Cancel render</PillButton>
      ) : (
        <PillButton onClick={() => inputRef.current?.click()} busy={uploading}>
          <Camera size={14} aria-hidden />
          {rendered ? "Try another photo" : "Upload a photo to try it on"}
        </PillButton>
      )}

      {photoUrl && !pending && (
        <PillButton onClick={discard}>
          <Trash2 size={14} aria-hidden />
          Delete this render
        </PillButton>
      )}

      <p style={BODY}>
        Your photo is used for this render and then it&apos;s gone — GYF deletes it as soon as the
        render finishes, and deletes the render itself within a day.
      </p>
    </Section>
  );
}

// A job we optimistically hold between the 202 and the first poll. Everything the server
// has not told us yet stays null — the UI must not invent a confidence or a render.
const EMPTY_JOB: TryOnJob = {
  job_id: "",
  status: "queued",
  item_ids: [],
  image_url: null,
  confidence: null,
  model_version: null,
  rendered_slots: [],
  reason: "",
  error_code: null,
  attempts: 0,
  created_at: "",
  finished_at: null,
  expires_at: "",
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <span style={MONO}>See it on you</span>
      {children}
    </div>
  );
}

function PillButton({
  children,
  onClick,
  busy = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={busy}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        minHeight: "44px",
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-faint)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.6rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        borderRadius: "999px",
      }}
    >
      {children}
    </button>
  );
}
