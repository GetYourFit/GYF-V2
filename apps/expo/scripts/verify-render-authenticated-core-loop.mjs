#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

function options(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--"))
      throw new Error(`Invalid option near ${key ?? "end of arguments"}`);
    result[key.slice(2)] = value;
  }
  return result;
}
async function request(url, init = {}, expected = [200]) {
  const response = await fetch(url, init);
  if (!expected.includes(response.status))
    throw new Error(`${init.method ?? "GET"} ${new URL(url).pathname} returned ${response.status}`);
  return response.status === 204 ? null : response.json();
}
export async function verifyAuthenticatedCoreLoop(config) {
  const web = new URL(config.deploymentUrl);
  if (web.protocol !== "https:") throw new Error("deployment URL must use HTTPS");
  const auth = await request(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  if (!auth.access_token) throw new Error("authenticated session issued no access token");
  const headers = { authorization: `Bearer ${auth.access_token}`, "content-type": "application/json" };
  await request(`${config.apiUrl}/profile`, {
    method: "PUT", headers,
    body: JSON.stringify({ gender: "women", style_intent: ["minimalist"], budget_range: { max: 5000, currency: "INR" }, occasion: "casual" }),
  });
  const slate = await request(`${config.apiUrl}/outfits/recommend?occasion=casual&k=1`, { headers });
  const outfit = slate.outfits?.[0];
  if (!slate.recommendation_id || !outfit?.items?.length || !outfit.explanation)
    throw new Error("Stylist returned no complete explained outfit");
  await request(`${config.apiUrl}/collections/outfits`, {
    method: "POST", headers,
    body: JSON.stringify({ outfit_key: `${slate.recommendation_id}:0`, item_ids: outfit.items.map((item) => item.item_id), recommendation_id: slate.recommendation_id, occasion: slate.occasion ?? "casual", explanation: outfit.explanation, score: outfit.score, confidence: outfit.confidence }),
  }, [200, 201]);
  const feedback = (item, action, context) => request(`${config.apiUrl}/feedback`, {
    method: "POST", headers,
    body: JSON.stringify({ event_id: randomUUID(), target_type: "item", target_id: item.item_id, action, context }),
  }, [202]);
  await feedback(outfit.items[0], "save", { recommendation_id: slate.recommendation_id, rank: 0 });
  const explore = await request(`${config.apiUrl}/items/browse?k=1`, { headers });
  if (!Array.isArray(explore.results) || explore.results.length === 0) throw new Error("Explore returned no catalogue items");
  let shop = "not_applicable";
  const shoppable = outfit.items.find((item) => /^https:\/\//.test(item.affiliate_url ?? ""));
  if (shoppable) {
    await feedback(shoppable, "shop_click", { attribution_version: 1, placement: "stylist_outfit", recommendation_id: slate.recommendation_id, rank: 0, session_id: randomUUID(), subid: slate.recommendation_id });
    shop = "verified";
  }
  return { schema_version: 1, provider: "render-static", stage: config.stage, deployment_url: web.toString().replace(/\/$/, ""), verified: true, verified_at: new Date().toISOString(), checks: { authenticated_session: true, manual_onboarding: true, stylist: true, explore: true, save_feedback: true, shop } };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = options(process.argv.slice(2));
  for (const name of ["deployment-url", "api-url", "supabase-url", "stage", "evidence-file"])
    if (!args[name]) throw new Error(`Missing required option --${name}`);
  for (const name of ["EXPO_PUBLIC_SUPABASE_ANON_KEY", "GYF_E2E_EMAIL", "GYF_E2E_PASSWORD"])
    if (!process.env[name]) throw new Error(`${name} is not configured`);
  const evidence = await verifyAuthenticatedCoreLoop({ deploymentUrl: args["deployment-url"], apiUrl: args["api-url"], supabaseUrl: args["supabase-url"], publishableKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, email: process.env.GYF_E2E_EMAIL, password: process.env.GYF_E2E_PASSWORD, stage: args.stage });
  writeFileSync(args["evidence-file"], `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`verify-render-authenticated-core-loop: ${evidence.stage} passed.`);
}
