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
        if (active) setCapable(true);
      });
    return () => {
      active = false;
    };
  }, [joined]);
  return capable;
}
