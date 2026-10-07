import { hasSiteIdentity, siteError, unauthorizedResponse } from "../../../../lib/site-auth";

const COLLECTION = "urn:wmo:md:pe-senamhi:synop-hourly";
const BASE = "https://wis.senamhi.gob.pe/oapi/collections/" + encodeURIComponent(COLLECTION) + "/items";
const ID_FIELDS = ["wigos_station_identifier", "station_id", "stationId", "id"];

function stationValue(feature: any) {
  const properties = feature && feature.properties ? feature.properties : {};
  for (const field of ID_FIELDS) {
    if (properties[field] != null) return String(properties[field]);
  }
  return feature && feature.id != null ? String(feature.id) : "";
}

export async function GET(request: Request) {
  if (!hasSiteIdentity(request)) return unauthorizedResponse();
  const station = new URL(request.url).searchParams.get("station") || "";
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(station)) {
    return siteError("Identificador de estación no válido.", 400);
  }

  try {
    for (const field of ID_FIELDS) {
      const url = new URL(BASE);
      url.searchParams.set("f", "json");
      url.searchParams.set("limit", "300");
      url.searchParams.set("filter-lang", "cql2-text");
      url.searchParams.set("filter", field + " = '" + station + "'");
      const upstream = await fetch(url, {
        headers: { Accept: "application/geo+json, application/json" },
        signal: AbortSignal.timeout(18000),
        cache: "no-store",
      });
      if (!upstream.ok) continue;
      const payload = await upstream.json();
      const features = Array.isArray(payload.features) ? payload.features : [];
      if (features.length) {
        return Response.json(payload, {
          headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
        });
      }
    }

    const fallback = new URL(BASE);
    fallback.searchParams.set("f", "json");
    fallback.searchParams.set("limit", "1000");
    const upstream = await fetch(fallback, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!upstream.ok) return siteError("SENAMHI no pudo entregar las observaciones horarias.", 502);
    const payload = await upstream.json();
    const features = Array.isArray(payload.features) ? payload.features : [];
    return Response.json(
      { ...payload, features: features.filter((feature: any) => stationValue(feature) === station) },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } },
    );
  } catch {
    return siteError("No se pudo conectar con las observaciones horarias de SENAMHI.", 502);
  }
}
