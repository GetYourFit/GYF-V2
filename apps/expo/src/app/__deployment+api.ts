import { environment, origin } from "expo-server";

export function GET(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const deploymentId = forwardedHost?.match(/--([a-z0-9]+)\.expo\.app$/i)?.[1] ?? null;
  const releaseSha = process.env.EXPO_PUBLIC_RELEASE_SHA ?? "unknown";

  return Response.json(
    {
      requestUrl: request.url,
      origin: origin(),
      forwardedHost,
      deploymentId,
      deployment_id: deploymentId,
      releaseSha,
      release_sha: releaseSha,
      // This is a safe public identity surface. It contains no tokens or user data;
      // the retained CI release record additionally binds the entry hash and API SHA.
      environment: environment(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
