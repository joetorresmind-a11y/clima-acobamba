const PROJECT_ID = "clima-f5f62";
const FIREBASE_ISSUER = "https://securetoken.google.com/" + PROJECT_ID;
const FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const SYNOP_COLLECTION = "urn:wmo:md:pe-senamhi:synop-hourly";
const SYNOP_BASE = "https://wis.senamhi.gob.pe/oapi/collections/" + encodeURIComponent(SYNOP_COLLECTION) + "/items";
const ID_FIELDS = ["wigos_station_identifier", "station_id", "stationId", "id"];
const DAILY_FIELDS = [
  "forecastDays.displayDate",
  "forecastDays.daytimeForecast.weatherCondition",
  "forecastDays.daytimeForecast.precipitation",
  "forecastDays.nighttimeForecast.precipitation",
  "forecastDays.nighttimeForecast.weatherCondition",
  "forecastDays.maxTemperature",
  "forecastDays.minTemperature",
].join(",");
const HOURLY_FIELDS = [
  "forecastHours.interval",
  "forecastHours.weatherCondition",
  "forecastHours.temperature",
  "forecastHours.precipitation",
].join(",");

let jwksCache = null;
let jwksCacheUntil = 0;

function configuredOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function requestOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const normalized = origin.replace(/\/$/, "");
  return configuredOrigins(env).includes(normalized) ? normalized : null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(data, status, origin, extraHeaders) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(origin),
    ...(extraHeaders || {}),
  });
  return new Response(JSON.stringify(data), { status, headers });
}

function base64UrlBytes(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  normalized += "=".repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function decodePart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
}

async function loadFirebaseKeys(forceRefresh) {
  if (!forceRefresh && jwksCache && Date.now() < jwksCacheUntil) return jwksCache;
  const response = await fetch(FIREBASE_JWKS, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!response.ok) throw new Error("Firebase public keys unavailable");
  const payload = await response.json();
  jwksCache = Array.isArray(payload.keys) ? payload.keys : [];
  jwksCacheUntil = Date.now() + 3600 * 1000;
  return jwksCache;
}

async function verifyFirebaseToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const header = decodePart(parts[0]);
    const claims = decodePart(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid) return false;
    if (claims.aud !== PROJECT_ID || claims.iss !== FIREBASE_ISSUER) return false;
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) return false;
    if (!Number.isFinite(claims.exp) || claims.exp <= now) return false;
    if (!Number.isFinite(claims.iat) || claims.iat > now + 60) return false;
    if (!Number.isFinite(claims.auth_time) || claims.auth_time > now + 60) return false;

    let keys = await loadFirebaseKeys(false);
    let jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
      keys = await loadFirebaseKeys(true);
      jwk = keys.find((key) => key.kid === header.kid);
    }
    if (!jwk) return false;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      base64UrlBytes(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    );
  } catch {
    return false;
  }
}

function errorResponse(message, status, origin) {
  return jsonResponse({ detail: message }, status, origin);
}

async function fetchJson(url, options, timeoutMs) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs || 18000),
  });
  if (!response.ok) return { ok: false, status: response.status, payload: null };
  try {
    return { ok: true, status: response.status, payload: await response.json() };
  } catch {
    return { ok: false, status: 502, payload: null };
  }
}

async function getStations(origin) {
  const url = "https://wis.senamhi.gob.pe/oapi/collections/stations/items?f=json&limit=1000";
  try {
    const result = await fetchJson(url, {
      headers: { Accept: "application/geo+json, application/json" },
      cf: { cacheTtl: 900, cacheEverything: true },
    }, 20000);
    if (!result.ok) return errorResponse("SENAMHI no pudo entregar el catálogo de estaciones.", 502, origin);
    return jsonResponse(result.payload, 200, origin, { "Cache-Control": "private, max-age=300" });
  } catch {
    return errorResponse("No se pudo conectar con el catálogo oficial de SENAMHI.", 502, origin);
  }
}

function findStationValue(value, names) {
  if (!value || typeof value !== "object") return "";
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (names.includes(normalized) && item != null && typeof item !== "object") return String(item);
  }
  for (const item of Object.values(value)) {
    const found = findStationValue(item, names);
    if (found) return found;
  }
  return "";
}

function stationIdentifier(feature) {
  const names = ID_FIELDS.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return findStationValue(feature && feature.properties ? feature.properties : feature, names)
    || String((feature && feature.id) || "");
}

async function getObservations(request, origin) {
  const station = new URL(request.url).searchParams.get("station") || "";
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(station)) {
    return errorResponse("Identificador de estación no válido.", 400, origin);
  }

  try {
    for (const field of ID_FIELDS) {
      const url = new URL(SYNOP_BASE);
      url.searchParams.set("f", "json");
      url.searchParams.set("limit", "300");
      url.searchParams.set("filter-lang", "cql2-text");
      url.searchParams.set("filter", field + " = '" + station + "'");
      const result = await fetchJson(url, {
        headers: { Accept: "application/geo+json, application/json" },
      }, 9000);
      const features = result.ok && result.payload && Array.isArray(result.payload.features)
        ? result.payload.features
        : [];
      const matching = features.filter((feature) => stationIdentifier(feature) === station);
      if (matching.length) {
        return jsonResponse({ ...result.payload, features: matching }, 200, origin);
      }
    }

    const fallback = new URL(SYNOP_BASE);
    fallback.searchParams.set("f", "json");
    fallback.searchParams.set("limit", "1000");
    const result = await fetchJson(fallback, {
      headers: { Accept: "application/geo+json, application/json" },
    }, 18000);
    if (!result.ok) return errorResponse("SENAMHI no pudo entregar las observaciones horarias.", 502, origin);
    const features = Array.isArray(result.payload.features) ? result.payload.features : [];
    const filtered = features.filter((feature) => stationIdentifier(feature) === station);
    return jsonResponse({ ...result.payload, features: filtered }, 200, origin);
  } catch {
    return errorResponse("No se pudo conectar con las observaciones horarias de SENAMHI.", 502, origin);
  }
}

function coordinates(url) {
  const latitude = Number(url.searchParams.get("location.latitude") || url.searchParams.get("latitude"));
  const longitude = Number(url.searchParams.get("location.longitude") || url.searchParams.get("longitude"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function weatherForecast(request, env, origin, interval) {
  const key = env.GOOGLE_WEATHER_API_KEY;
  if (!key) return errorResponse("El administrador aún no configuró la clave de Google Weather.", 503, origin);
  const input = new URL(request.url);
  const point = coordinates(input);
  if (!point) return errorResponse("Las coordenadas no son válidas.", 400, origin);

  const queryName = interval === "days" ? "days" : "hours";
  const maximum = interval === "days" ? 10 : 24;
  const requested = Number(input.searchParams.get(queryName) || (interval === "days" ? 7 : 24));
  if (!Number.isInteger(requested) || requested < 1 || requested > maximum) {
    return errorResponse("El número solicitado está fuera del rango permitido.", 400, origin);
  }

  const upstreamUrl = new URL("https://weather.googleapis.com/v1/forecast/" + interval + ":lookup");
  upstreamUrl.searchParams.set("key", key);
  upstreamUrl.searchParams.set("location.latitude", String(point.latitude));
  upstreamUrl.searchParams.set("location.longitude", String(point.longitude));
  upstreamUrl.searchParams.set(queryName, String(requested));
  upstreamUrl.searchParams.set("languageCode", "es-PE");
  upstreamUrl.searchParams.set("unitsSystem", "METRIC");
  const fieldMask = interval === "days" ? DAILY_FIELDS : HOURLY_FIELDS;

  try {
    const result = await fetchJson(upstreamUrl, {
      headers: { "X-Goog-FieldMask": fieldMask, Accept: "application/json" },
    }, 18000);
    if (!result.ok) {
      return errorResponse("Google Weather respondió con un error. Verifica la API, facturación y restricciones de la clave.", 502, origin);
    }
    return jsonResponse(result.payload, 200, origin, { "Cache-Control": "private, max-age=300" });
  } catch {
    return errorResponse("No se pudo conectar con Google Weather.", 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = requestOrigin(request, env);
    if (!origin) return new Response("Origen no permitido.", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "GET") return errorResponse("Método no permitido.", 405, origin);

    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/")) return errorResponse("Ruta no encontrada.", 404, origin);
    if (!(await verifyFirebaseToken(request))) {
      return errorResponse("Inicia sesión con una cuenta válida de Firebase.", 401, origin);
    }

    if (path === "/api/senamhi/stations") return getStations(origin);
    if (path === "/api/senamhi/observations") return getObservations(request, origin);
    if (path === "/api/weather/status") {
      return jsonResponse({ configured: Boolean(env.GOOGLE_WEATHER_API_KEY) }, 200, origin);
    }
    if (path === "/api/weather/days") return weatherForecast(request, env, origin, "days");
    if (path === "/api/weather/hours") return weatherForecast(request, env, origin, "hours");
    return errorResponse("Ruta no encontrada.", 404, origin);
  },
};
