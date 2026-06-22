import type { Metadata } from "next";

export const metadata: Metadata = { title: "Saved · GYF" };

// Saved collection (M8). Placeholder until the collections milestone; the nav links
// here so the surface is coherent. Saved looks are already captured server-side via
// /feedback (action=save), so this fills in without backend work later.
export default function SavedPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="font-[family-name:var(--font-body)] text-[10.5px] uppercase tracking-[0.4em] text-[var(--gold)]">
        Collections
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[var(--text)]">
        Your saved looks
      </h1>
      <p className="mt-3 text-sm text-[var(--faint)]">
        Looks you save will gather here. This collection view arrives with the next milestone — your
        saves are already being remembered.
      </p>
    </div>
  );
}
