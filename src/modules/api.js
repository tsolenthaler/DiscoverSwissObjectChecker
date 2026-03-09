export function buildApiUrl(config, endpoint, objectId) {
  const base = String(config.baseUrl || "").replace(/\/+$/, "");
  const safeEndpoint = String(endpoint || "").replace(/^\/+/, "");
  const safeId = encodeURIComponent(String(objectId || "").trim());

  if (!base || !safeEndpoint || !safeId) {
    throw new Error("Ungueltige URL-Bestandteile fuer den API-Request.");
  }

  const url = new URL(`${base}/${safeEndpoint}/${safeId}`);

  if (config.project) {
    url.searchParams.set("project", config.project);
  }
  if (config.language) {
    url.searchParams.set("language", config.language);
  }

  return url.toString();
}

export async function fetchObjectById(config, endpoint, objectId) {
  const requestUrl = buildApiUrl(config, endpoint, objectId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const baseMessage = `API Fehler ${response.status}: ${response.statusText || "Unbekannt"}`;
      if (response.status === 404) {
        throw new Error(`${baseMessage}. Objekt wurde nicht gefunden.`);
      }
      throw new Error(baseMessage);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Antwort ist kein JSON. Bitte API-Konfiguration pruefen.");
    }

    const json = await response.json();
    return {
      json,
      requestUrl
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request Timeout: Die API hat nicht rechtzeitig geantwortet.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Netzwerk/CORS Problem: Request konnte nicht ausgefuehrt werden. Pruefe Browser-CORS, URL und Internetverbindung."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
