import Link from "next/link";
import { Suspense, type ReactNode } from "react";

/** Centered shell for the auth pages. The marketing site stays at /. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-lg font-semibold tracking-tight text-neutral-900"
        >
          GYF
        </Link>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          {/* useSearchParams (in AuthForm) requires a Suspense boundary. */}
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </div>
    </main>
  );
}
