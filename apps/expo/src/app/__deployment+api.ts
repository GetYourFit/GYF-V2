import { environment, origin } from "expo-server";

export function GET(request: Request) {
  return Response.json(
    {
      requestUrl: request.url,
      origin: origin(),
      forwardedHost: request.headers.get("x-forwarded-host"),
      environment: environment(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
