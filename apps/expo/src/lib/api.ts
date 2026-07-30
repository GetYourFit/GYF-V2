import {
  ApiError,
  GyfApi as SharedGyfApi,
  type CatalogFacets,
  type MultipartFile,
  type RecommendParams,
  type SearchParams,
  type TokenProvider,
} from "@gyf/api-client";

import { publicEnv } from "./env";
import { getAccessToken } from "./auth";

export { ApiError };
export type { CatalogFacets, MultipartFile, RecommendParams, SearchParams, TokenProvider };
export * from "@gyf/types";

/** Expo binding for the framework-neutral transport. Auth and public origin are injected here. */
export class GyfApi extends SharedGyfApi {
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
