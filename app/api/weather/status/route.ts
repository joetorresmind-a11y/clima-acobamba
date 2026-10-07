import { hasSiteIdentity, unauthorizedResponse } from "../../../../lib/site-auth";

export async function GET(request: Request) {
  if (!hasSiteIdentity(request)) return unauthorizedResponse();
  return Response.json(
    { configured: Boolean(process.env.GOOGLE_WEATHER_API_KEY) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
