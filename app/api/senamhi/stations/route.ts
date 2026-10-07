import { hasSiteIdentity, siteError, unauthorizedResponse } from "../../../../lib/site-auth";

const UPSTREAM = "https://wis.senamhi.gob.pe/oapi/collections/stations/items?f=json&limit=1000";

export async function GET(request: Request) {
  if (!hasSiteIdentity(request)) return unauthorizedResponse();
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 900 },
    });
    if (!upstream.ok) return siteError("SENAMHI no pudo entregar el catálogo de estaciones.", 502);
    const data = await upstream.json();
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch {
    return siteError("No se pudo conectar con el catálogo oficial de SENAMHI.", 502);
  }
}
