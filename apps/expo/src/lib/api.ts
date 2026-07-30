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
import type { components } from "@gyf/types";

export { ApiError };
export type UploadProgress = (progress: { loaded: number; total: number | null }) => void;
export type { CatalogFacets, MultipartFile, RecommendParams, SearchParams, TokenProvider };
export * from "@gyf/types";

type ProfilePhotoResponse = components["schemas"]["ProfilePhotoResponse"];

/** Expo binding for the framework-neutral transport. Auth and public origin are injected here. */
export class GyfApi extends SharedGyfApi {
  constructor(
    private readonly expoToken: TokenProvider = getAccessToken,
    private readonly expoBase = publicEnv.apiUrl,
  ) {
    super(expoToken, expoBase);
  }

  async uploadPhoto(
    file: File | MultipartFile,
    signal?: AbortSignal,
    onProgress?: UploadProgress,
  ): Promise<ProfilePhotoResponse> {
    const form = new FormData();
    form.append("photo", file as Blob);
    const token = await this.expoToken();
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);

    if (onProgress && typeof XMLHttpRequest !== "undefined") {
      return this.uploadWithProgress(form, headers, signal, onProgress);
    }

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 60_000);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;
    try {
      const response = await fetch(`${this.expoBase}/profile/photo?persist=false`, {
        method: "POST",
        headers,
        body: form,
        signal: requestSignal,
      });
      return await parsePhotoResponse(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  private uploadWithProgress(
    form: FormData,
    headers: Headers,
    signal: AbortSignal | undefined,
    onProgress: UploadProgress,
  ): Promise<ProfilePhotoResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      };
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const abort = () =>
        finish(() => {
          xhr.abort();
          reject(new DOMException("Aborted", "AbortError"));
        });
      const timeout = setTimeout(
        () =>
          finish(() => {
            xhr.abort();
            reject(new DOMException("Upload timed out", "TimeoutError"));
          }),
        60_000,
      );

      xhr.open("POST", `${this.expoBase}/profile/photo?persist=false`);
      headers.forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) =>
        onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : null });
      xhr.onload = () =>
        finish(() => {
          const data = parseJson(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new ApiError(xhr.status, errorMessage(data, xhr.statusText), data));
          } else {
            resolve(data as ProfilePhotoResponse);
          }
        });
      xhr.onerror = () => finish(() => reject(new Error("Network request failed")));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      else xhr.send(form);
    });
  }
}

async function parsePhotoResponse(response: Response): Promise<ProfilePhotoResponse> {
  const data = parseJson(await response.text());
  if (!response.ok)
    throw new ApiError(response.status, errorMessage(data, response.statusText), data);
  return data as ProfilePhotoResponse;
}

function parseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export function createApi(
  getToken: TokenProvider = getAccessToken,
  base = publicEnv.apiUrl,
): GyfApi {
  return new GyfApi(getToken, base);
}
