const DEFAULT_CUELINKS_WEB_CID = "305057";
const CUELINKS_CDN_BASE = "cdn0.cuelinks.com/js/";
const CUELINKS_SCRIPT_NAME = "cuelinksv2.js";
const CUELINKS_RUNTIME_GUARD = "__gyfCuelinksWebLoaderInstalled";

type CuelinksWebConfigValues = {
  EXPO_PUBLIC_CUELINKS_CID?: string;
};

export type CuelinksWebConfig = {
  cid: string;
  source: "default";
};

export function readCuelinksWebConfig(values: CuelinksWebConfigValues): CuelinksWebConfig {
  const raw = values.EXPO_PUBLIC_CUELINKS_CID?.trim();
  if (raw && raw !== DEFAULT_CUELINKS_WEB_CID) {
    throw new Error(`EXPO_PUBLIC_CUELINKS_CID must be fixed to ${DEFAULT_CUELINKS_WEB_CID}`);
  }
  return { cid: DEFAULT_CUELINKS_WEB_CID, source: "default" };
}

export function cuelinksScriptUrlForProtocol(protocol: "http:" | "https:"): string {
  return `${protocol === "https:" ? "https" : "http"}://${CUELINKS_CDN_BASE}${CUELINKS_SCRIPT_NAME}`;
}

/**
 * Keep this as the captain-provided EXPO channel snippet, including its source
 * spelling. The live vendor check rejected the previous single-quoted rewrite;
 * source inspection shows it diverges from this supplied reference before the
 * browser can request the SDK.
 */
export function buildCuelinksWebLoaderScript(cid: string): string {
  if (!/^\d+$/.test(cid)) {
    throw new Error("Cuelinks cId must contain only digits");
  }

  const vendorLoader = [
    `var cId =  "${cid}";`,
    ``,
    `(function(d, t) {`,
    `  var s = document.createElement("script");`,
    `  s.type = "text/javascript";`,
    `  s.async = true;`,
    `  s.src = (document.location.protocol == "https:" ? "https://${CUELINKS_CDN_BASE}" : "http://${CUELINKS_CDN_BASE}")  + "${CUELINKS_SCRIPT_NAME}";`,
    `  document.getElementsByTagName("body")[0].appendChild(s);`,
    `}());`,
  ].join("\n");

  return [
    `if (!window.${CUELINKS_RUNTIME_GUARD}) {`,
    `  window.${CUELINKS_RUNTIME_GUARD} = true;`,
    vendorLoader
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
    `}`,
  ].join("\n");
}

export const cuelinksWebConfig = readCuelinksWebConfig({
  EXPO_PUBLIC_CUELINKS_CID: process.env.EXPO_PUBLIC_CUELINKS_CID,
});
