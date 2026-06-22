import Link from "next/link";

// Placeholder for the stylist experience (M6). Kept intentionally thin: the full
// recommend → render → feedback loop lands in the next milestone. New users are
// pointed at onboarding first.
export default function StylistPage() {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Your stylist is almost ready</h1>
      <p className="mt-3 text-neutral-600">
        Set up your style profile, then GYF will build complete, explained outfits tuned to you.
      </p>
      <Link
        href="/app/onboarding"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Set up my profile
      </Link>
    </div>
  );
}
