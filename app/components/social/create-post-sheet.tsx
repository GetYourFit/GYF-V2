"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ImagePlus } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SocialPost } from "./post-card";

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  onPost: (post: SocialPost) => void;
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CreatePostSheet({ open, onClose, onPost }: CreatePostSheetProps) {
  const captionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleImage(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) { setPreviewUrl(null); return; }
    if (!file.type.startsWith("image/")) { setError("Please choose an image."); return; }
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  function reset() {
    setCaption("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  }

  function handleClose() { reset(); onClose(); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caption.trim()) { setError("Add a caption before posting."); return; }
    onPost({
      id: randomId(),
      author: { name: "You", handle: "you", avatarInitial: "Y" },
      caption: caption.trim(),
      imageUrl: previewUrl ?? undefined,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    });
    reset();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70"
            onClick={handleClose}
          />
          <motion.aside
            key="sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-none border-t border-[var(--border-mid)] bg-[var(--surface)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 bg-[var(--border-hi)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <p className="t-title text-[var(--text)]">New post</p>
              <button type="button" aria-label="Close" onClick={handleClose}
                className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
              {/* Image picker */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center border border-dashed border-[var(--border-mid)] bg-[var(--surface-2)] transition-colors active:opacity-70"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[var(--text-faint)]">
                    <ImagePlus size={28} />
                    <span className="t-caption">Tap to add photo</span>
                  </div>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
              />

              {/* Caption */}
              <div className="flex flex-col gap-2">
                <label htmlFor={captionId} className="t-label text-[var(--text-faint)]">Caption</label>
                <textarea
                  id={captionId}
                  rows={3}
                  placeholder="Describe your outfit…"
                  value={caption}
                  onChange={(e) => { setCaption(e.target.value); setError(null); }}
                  className="w-full resize-none border border-[var(--border-mid)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                />
              </div>

              {error && <p role="alert" className="t-caption text-[var(--error)]">{error}</p>}

              <Button type="submit" variant="primary" size="lg" className="w-full mt-auto">
                Post
              </Button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
