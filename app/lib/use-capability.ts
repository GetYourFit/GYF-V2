"use client";

import { useEffect, useState } from "react";

import { browserApi } from "@/lib/api-client";

const USABLE = new Set(["live", "beta"]);

/**
 * Whether at least one of the named `/system/status` capabilities is usable
 * (`live` or `beta`). `null` while the status is loading. Fails open on a
 * status-fetch error — the API refuses sensitive uploads before processing
 * them either way; this hook only stops the UI from *offering* an upload the
 * deployment could never use (F1b truthfulness).
 */
export function useCapability(...keys: string[]): boolean | null {
  return useCapabilityWithFallback(keys, true);
}

/**
 * Like {@link useCapability}, but fails **closed**: a status-fetch error reports the
 * capability as unavailable.
 *
 * Use this wherever the UI would otherwise ask for something sensitive it may not be
 * able to use. Failing open is the right default for a capability whose absence just
 * means "fall back to the manual path" — but for virtual try-on the ask is a photo of
 * the user's body, and a transient `/system/status` blip must never be the reason GYF
 * solicits one. Try-on is closed until its evaluation gate passes; the UI has to be
 * closed too.
 */
export function useCapabilityStrict(...keys: string[]): boolean | null {
  return useCapabilityWithFallback(keys, false);
}

function useCapabilityWithFallback(keys: string[], onError: boolean): boolean | null {
  const [capable, setCapable] = useState<boolean | null>(null);
  const joined = keys.join(",");
  useEffect(() => {
    let active = true;
    browserApi()
      .systemStatus()
      .then((s) => {
        if (active) {
          setCapable(joined.split(",").some((k) => USABLE.has(s.capabilities[k]?.status ?? "")));
        }
      })
      .catch(() => {
        if (active) setCapable(onError);
      });
    return () => {
      active = false;
    };
  }, [joined, onError]);
  return capable;
}
