export function unauthorizedResponse() {
  return Response.json(
    { detail: "Inicia sesión en el sitio para consultar este servicio." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function hasSiteIdentity(request: Request) {
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(request.headers.get("oai-authenticated-user-id"));
}

export function siteError(message: string, status = 502) {
  return Response.json(
    { detail: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function validCoordinates(search: URLSearchParams) {
  const latitude = Number(search.get("location.latitude") ?? search.get("latitude"));
  const longitude = Number(search.get("location.longitude") ?? search.get("longitude"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
