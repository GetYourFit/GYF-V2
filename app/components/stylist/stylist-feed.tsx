"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { OutfitCard } from "@/components/stylist/outfit-card";
import { StylistControls, type StylistQuery } from "@/components/stylist/stylist-controls";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { InteractionAction } from "@gyf/types";
import type { OutfitRecommendation } from "@gyf/types";

const EMPTY_QUERY: StylistQuery = { goal: "", occasion: "" };

export function StylistFeed() {
  const [query, setQuery] = useState<StylistQuery>(EMPTY_QUERY);
  const [data, setData] = useState<OutfitRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const load = useCallback(async (q: StylistQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApi().recommend({
        goal: q.goal || undefined,
        occasion: q.occasion || undefined,
        k: 6,
      });
      setData(res);
      setSaved(new Set());
      setDismissed(new Set());
    } catch (e) {
      if (e instanceof ApiError && e.isNotOnboarded) setNeedsOnboarding(true);
      else setError(e instanceof Error ? e.message : "Could not reach your stylist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to a microtask so the synchronous setState inside `load` doesn't run
    // in the effect body (avoids cascading renders flagged by react-hooks).
    void Promise.resolve().then(() => load(EMPTY_QUERY));
  }, [load]);

  function apply(q: StylistQuery) {
    setQuery(q);
    void load(q);
  }

  async function sendFeedback(index: number, action: InteractionAction) {
    if (!data) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    const recommendation_id = data.recommendation_id;
    await Promise.all(
      outfit.items.map((item) =>
        browserApi().feedback({
          target_type: "item",
          target_id: item.item_id,
          action,
          context: { recommendation_id },
        }),
      ),
    );
  }

  function onSave(index: number) {
    setSaved((s) => new Set(s).add(index)); // optimistic
    void sendFeedback(index, "save").catch(() =>
      setSaved((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      }),
    );
  }

  function onDismiss(index: number) {
    setDismissed((d) => new Set(d).add(index)); // optimistic
    void sendFeedback(index, "skip").catch(() =>
      setDismissed((d) => {
        const next = new Set(d);
        next.delete(index);
        return next;
      }),
    );
  }

  function undoDismiss(index: number) {
    setDismissed((d) => {
      const next = new Set(d);
      next.delete(index);
      return next;
    });
  }

  if (needsOnboarding) {
    return (
      <Centered>
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--text)]">
          First, tell GYF about you
        </p>
        <p className="mt-2 text-sm text-[var(--faint)]">
          A few quick preferences and your stylist gets to work.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex min-h-11 items-center bg-[var(--text)] px-6 font-[family-name:var(--font-body)] text-[11px] uppercase tracking-[0.18em] text-[var(--bg)] hover:bg-[var(--gold)]"
        >
          Set up my profile
        </Link>
      </Centered>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-[family-name:var(--font-body)] text-[10.5px] uppercase tracking-[0.4em] text-[var(--gold)]">
          Your stylist
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] leading-[1.05] text-[var(--text)]">
          Complete looks, made for you
        </h1>
        {data && <StatusLine data={data} />}
      </header>

      <StylistControls value={query} busy={loading} onApply={apply} />

      {error && (
        <p
          role="alert"
          className="border border-[#8a2b22]/30 bg-[#8a2b22]/5 px-4 py-3 text-sm text-[#8a2b22]"
        >
          {error}
        </p>
      )}

      {loading && <SkeletonGrid />}

      {!loading && data && data.outfits.length === 0 && (
        <Centered>
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--text)]">
            No complete looks for this just yet
          </p>
          <p className="mt-2 text-sm text-[var(--faint)]">
            The catalog couldn&apos;t fill a full outfit for these settings — try a different
            occasion or clear your goal.
          </p>
        </Centered>
      )}

      {!loading && data && data.outfits.length > 0 && (
        <div className="grid grid-cols-1 gap-px bg-transparent sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          {data.outfits.map((outfit, i) =>
            dismissed.has(i) ? (
              <UndoStrip key={i} index={i} onUndo={() => undoDismiss(i)} />
            ) : (
              <OutfitCard
                key={i}
                outfit={outfit}
                index={i}
                saved={saved.has(i)}
                onSave={() => onSave(i)}
                onDismiss={() => onDismiss(i)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function StatusLine({ data }: { data: OutfitRecommendation }) {
  const parts: string[] = [];
  parts.push(data.cold_start ? "Cold start" : "Personalized");
  if (data.personalized && data.taste_strength > 0) {
    parts.push(`taste ${Math.round(data.taste_strength * 100)}%`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[var(--faint)]">
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]">
        {parts.join(" · ")}
      </span>
      {data.applied_goals.map((g) => (
        <span
          key={g}
          className="bg-[var(--gold-light)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] text-[var(--gold)]"
        >
          {g}
        </span>
      ))}
    </div>
  );
}

function UndoStrip({ index, onUndo }: { index: number; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between border border-dashed border-[var(--border-mid)] bg-[var(--surface)]/50 px-4 py-6 text-sm text-[var(--faint)]">
      <span>Removed look {index + 1}</span>
      <button
        type="button"
        onClick={onUndo}
        className="uppercase tracking-[0.16em] text-[var(--gold)] hover:underline"
      >
        Undo
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col border border-[var(--rule)] bg-[var(--surface)]">
          <div className="aspect-[3/4] animate-pulse bg-[var(--wash)]" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-3/4 animate-pulse bg-[var(--wash)]" />
            <div className="h-3 w-1/2 animate-pulse bg-[var(--wash)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-16 text-center">{children}</div>;
}
