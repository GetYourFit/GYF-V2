// OpenNext → Cloudflare adapter config. Defaults are correct for a standard
// Next.js App Router app; caching can be layered on later (KV/R2/D1) if needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
