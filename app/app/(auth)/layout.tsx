import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 sm:py-16">
      {/* Left brand panel — hidden on small screens */}
      <div className="fixed inset-y-0 left-0 hidden w-[46%] flex-col justify-between border-r border-rule px-14 py-14 lg:flex">
        <Link href="/" className="inline-flex items-center gap-3 group" aria-label="GYF home">
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={36}
            height={36}
            className="opacity-90 group-hover:opacity-60 transition-opacity duration-200"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <span className="t-wordmark text-xl text-text opacity-90 group-hover:opacity-60 transition-opacity duration-200">
            GYF
          </span>
        </Link>
        <div>
          <p className="t-display text-[clamp(2rem,4vw,3.5rem)] text-text leading-[1.06]">
            Your style,
            <br />
            <em className="italic">finally</em>
            <br />
            intelligent.
          </p>
          <p className="mt-6 t-caption max-w-[340px]">
            An AI personal stylist that learns what looks good on you and builds complete,
            coordinated outfits you can trust.
          </p>
        </div>
        <p className="t-mono text-text-faint">© GYF {new Date().getFullYear()}</p>
      </div>

      {/* Right form panel */}
      <div className="w-full max-w-[420px] lg:ml-[46%]">
        {/* Mobile logo */}
        <Link href="/" className="mb-10 flex flex-col items-center gap-2 lg:hidden group" aria-label="GYF home">
          <Image
            src="/assets/logo.png"
            alt=""
            width={44}
            height={44}
            className="group-hover:opacity-70 transition-opacity duration-200"
            style={{ filter: "brightness(0) invert(1)" }}
            aria-hidden
          />
          <span className="t-wordmark text-2xl text-text">GYF</span>
        </Link>
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </main>
  );
}
