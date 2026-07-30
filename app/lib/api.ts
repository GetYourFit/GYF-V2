// Next.js compatibility facade for the framework-neutral transport.
//
// Expo and Next share the same implementation in @gyf/api-client while the
// retained Next oracle owns only its browser origin and Supabase binding. Keep
// this module until the protected F13 parity/rollback deletion gate closes.
import { GyfApi as SharedGyfApi, type TokenProvider, type MultipartFile } from "@gyf/api-client";

export * from "@gyf/api-client";
export type { MultipartFile, TokenProvider };

const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class GyfApi extends SharedGyfApi {
  constructor(getToken: TokenProvider = () => null, base = DEFAULT_BASE, timeoutMs?: number) {
    super(getToken, base, timeoutMs);
  }
}

export function createApi(getToken: TokenProvider = () => null, base = DEFAULT_BASE): GyfApi {
  return new GyfApi(getToken, base);
}
