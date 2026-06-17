async function getApiHealth(): Promise<{ status: string } | null> {
  try {
    const base = process.env.API_BASE_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { status: string };
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getApiHealth();
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 720 }}>
      <h1>GYF — Get Your Fit</h1>
      <p>AI-native personal stylist. Phase P0 — Foundations.</p>
      <p>
        Core API: <strong>{health ? health.status : "unreachable"}</strong>
      </p>
    </main>
  );
}
