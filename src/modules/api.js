export function buildApiUrl(config, endpoint, objectId, options = {}) {
  const base = String(config.baseUrl || "").replace(/\/+$/, "");
  const safeEndpoint = String(endpoint || "").replace(/^\/+/, "");
  const safeId = encodeURIComponent(String(objectId || "").trim());
  const scope = String(options.scope || "").trim();

  if (!base || !safeEndpoint || !safeId) {
    throw new Error("Ungueltige URL-Bestandteile fuer den API-Request.");
  }

  const url = new URL(`${base}/${safeEndpoint}/${safeId}`);

  if (config.project) {
    url.searchParams.set("project", config.project);
  }
  if (scope) {
    url.searchParams.set("scope", scope);
  }

  return url.toString();
}

export function buildSearchUrl(config, options = {}) {
  const base = String(config.baseUrl || "").replace(/\/+$/, "");
  const searchText = String(options.searchText || "").trim();
  const resultsPerPageRaw = options.resultsPerPage;
  const filters = String(options.filters || "").trim();
  const viewId = String(options.viewId || "").trim();

  if (!base) {
    throw new Error("Ungueltige URL-Bestandteile fuer den API-Request.");
  }

  const url = new URL(`${base}/search`);

  if (searchText) {
    url.searchParams.set("searchText", searchText);
  }

  const resultsPerPage = Number.parseInt(String(resultsPerPageRaw ?? "").trim(), 10);
  if (Number.isFinite(resultsPerPage) && resultsPerPage > 0) {
    url.searchParams.set("resultsPerPage", String(resultsPerPage));
  }

  if (filters) {
    url.searchParams.set("filters", filters);
  }

  if (viewId) {
    url.searchParams.set("viewId", viewId);
  }

  if (config.project) {
    url.searchParams.set("project", config.project);
  }

  return url.toString();
}

export function buildSearchViewsUrl(config, options = {}) {
  const base = String(config.baseUrl || "").replace(/\/+$/, "");
  const project = String(options.project ?? config.project ?? "").trim();
  const select = String(options.select || "").trim();

  if (!base) {
    throw new Error("Ungueltige URL-Bestandteile fuer den API-Request.");
  }

  const url = new URL(`${base}/search/views`);

  if (project) {
    url.searchParams.set("project", project);
  }

  if (select) {
    url.searchParams.set("select", select);
  }

  return url.toString();
}

export async function fetchObjectById(config, endpoint, objectId, options = {}) {
  const apiKey = String(config?.apiKey || "").trim();
  const language = String(options?.language ?? config?.language ?? "").trim();
  const scope = String(options?.scope || "").trim();
  if (!apiKey) {
    throw new Error("API-Key fehlt. Bitte in der Konfiguration den Ocp-Apim-Subscription-Key setzen.");
  }

  const requestUrl = buildApiUrl(config, endpoint, objectId, { scope });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers = {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey
    };

    if (language) {
      headers["Accept-Language"] = language;
    }

    if (scope) {
      headers.scope = scope;
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
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

export async function fetchSearchResults(config, options = {}) {
  const apiKey = String(config?.apiKey || "").trim();
  const language = String(options?.language ?? config?.language ?? "").trim();
  if (!apiKey) {
    throw new Error("API-Key fehlt. Bitte in der Konfiguration den Ocp-Apim-Subscription-Key setzen.");
  }

  const requestUrl = buildSearchUrl(config, {
    searchText: options.searchText,
    resultsPerPage: options.resultsPerPage,
    filters: options.filters,
    viewId: options.viewId
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers = {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey
    };

    if (language) {
      headers["Accept-Language"] = language;
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const baseMessage = `API Fehler ${response.status}: ${response.statusText || "Unbekannt"}`;
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

export async function fetchSearchViews(config, options = {}) {
  const apiKey = String(config?.apiKey || "").trim();
  const language = String(options?.language ?? config?.language ?? "").trim();
  if (!apiKey) {
    throw new Error("API-Key fehlt. Bitte in der Konfiguration den Ocp-Apim-Subscription-Key setzen.");
  }

  const requestUrl = buildSearchViewsUrl(config, {
    project: options.project,
    select: options.select
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers = {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey
    };

    if (language) {
      headers["Accept-Language"] = language;
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const baseMessage = `API Fehler ${response.status}: ${response.statusText || "Unbekannt"}`;
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
