import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (process.env.NODE_ENV === "production" && pathname === "/design") {
    return new NextResponse("Not Found", { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!login|signup|forgot-password|reset-password|design|api|_next/static|_next/image|favicon.ico|assets).*)",
  ],
};
