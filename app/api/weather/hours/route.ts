import { hasSiteIdentity, siteError, unauthorizedResponse, validCoordinates } from "../../../../lib/site-auth";

const FIELD_MASK = [
  "forecastHours.interval",
  "forecastHours.weatherCondition",
  "forecastHours.temperature",
  "forecastHours.precipitation",
].join(",");

export async function GET(request: Request) {
  if (!hasSiteIdentity(request)) return unauthorizedResponse();
  const key = process.env.GOOGLE_WEATHER_API_KEY;
  if (!key) return siteError("El administrador aún no configuró la clave de Google Weather.", 503);
  const input = new URL(request.url);
  const coordinates = validCoordinates(input.searchParams);
  if (!coordinates) return siteError("Las coordenadas no son válidas.", 400);
  const requestedHours = Number(input.searchParams.get("hours") || 24);
  if (!Number.isInteger(requestedHours) || requestedHours < 1 || requestedHours > 24) {
    return siteError("El pronóstico horario admite de 1 a 24 horas.", 400);
  }

  const upstreamUrl = new URL("https://weather.googleapis.com/v1/forecast/hours:lookup");
  upstreamUrl.searchParams.set("key", key);
  upstreamUrl.searchParams.set("location.latitude", String(coordinates.latitude));
  upstreamUrl.searchParams.set("location.longitude", String(coordinates.longitude));
  upstreamUrl.searchParams.set("hours", String(requestedHours));
  upstreamUrl.searchParams.set("languageCode", "es-PE");
  upstreamUrl.searchParams.set("unitsSystem", "METRIC");

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "X-Goog-FieldMask": FIELD_MASK, Accept: "application/json" },
      signal: AbortSignal.timeout(18000),
      cache: "no-store",
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      return siteError("Google Weather respondió con un error. Verifica la API, la facturación y las restricciones de la clave.", 502);
    }
    return Response.json(payload, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return siteError("No se pudo conectar con el pronóstico horario de Google Weather.", 502);
  }
}
