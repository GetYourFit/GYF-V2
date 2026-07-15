import {
  ApiError,
  GyfApi as WebGyfApi,
  type SearchParams,
  type TokenProvider,
} from "../../../../app/lib/api";

import { publicEnv } from "./env";
import { getAccessToken } from "./auth";

export { ApiError };
export type { SearchParams, TokenProvider };
export * from "@gyf/types";

/** Expo binding for the existing typed transport; the web implementation stays untouched. */
export class GyfApi extends WebGyfApi {
  constructor(getToken: TokenProvider = getAccessToken, base = publicEnv.apiUrl) {
    super(getToken, base);
  }
}

export function createApi(
  getToken: TokenProvider = getAccessToken,
  base = publicEnv.apiUrl,
): GyfApi {
  return new GyfApi(getToken, base);
}
