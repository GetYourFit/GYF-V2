import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/** Guards the authenticated product surface. The marketing site (/) and the auth
 *  pages (/login, /signup) stay public; everything under /app requires a session. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*"],
};
