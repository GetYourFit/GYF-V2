import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/** Guards the product surface, which now lives at the root. Only the auth pages
 *  (/login, /signup) are public; every other route requires a session and is sent
 *  to /login (with ?next=) when anonymous. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Match everything except the auth pages, API routes, and static assets.
  matcher: ["/((?!login|signup|api|_next/static|_next/image|favicon.ico|assets).*)"],
};
