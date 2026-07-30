import { setResponseHeaders } from "expo-server";

import { SECURITY_HEADERS } from "../lib/security-headers";

/**
 * Apply the security contract at the EAS server response boundary.
 *
 * The expo-router config generates these headers in the exported route manifest,
 * but EAS Hosting 21.4.0 served the immutable deployment without X-Frame-Options.
 * Setting them from server middleware keeps the contract true for HTML and API
 * responses instead of relying on a provider-side manifest transformation alone.
 */
export default function middleware(_request: Request) {
  setResponseHeaders(SECURITY_HEADERS);
}
