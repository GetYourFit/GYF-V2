import type { Metadata } from "next";

import { SavedGrid } from "@/components/saved/saved-grid";

export const metadata: Metadata = { title: "Saved · GYF" };

export default function SavedPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="t-label text-[var(--text-faint)]">Collections</p>
        <h1 className="t-headline text-[var(--text)]">Saved looks</h1>
      </header>
      <SavedGrid />
    </div>
  );
}
