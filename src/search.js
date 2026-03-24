import { DEFAULT_CONFIG } from "./modules/constants.js";
import {
  getActiveConfigId,
  getAllConfigs,
  getConfigById,
  markConfigAsUsed,
  saveConfig,
  setActiveConfigId
} from "./modules/configStore.js";
import { fetchSearchResults, fetchSearchViews } from "./modules/api.js";
import { renderStatus } from "./modules/renderers.js";

const state = {
  activeConfigId: null,
  lastPayload: null,
  lastRequestUrl: "",
  viewLoadRequestId: 0
};

const elements = {
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  languageInput: document.getElementById("languageInput"),
  resultsPerPageInput: document.getElementById("resultsPerPageInput"),
  viewSelect: document.getElementById("viewSelect"),
  publishCheckbox: document.getElementById("publishCheckbox"),
  identifierInput: document.getElementById("identifierInput"),
  searchButton: document.getElementById("searchButton"),
  status: document.getElementById("status"),
  configSelect: document.getElementById("configSelect"),
  resultsList: document.getElementById("resultsList"),
  resultCount: document.getElementById("resultCount"),
  searchQueryUrl: document.getElementById("searchQueryUrl"),
  copyQueryUrlButton: document.getElementById("copyQueryUrlButton"),
  openJsonButton: document.getElementById("openJsonButton"),
  jsonDialog: document.getElementById("jsonDialog"),
  jsonOutput: document.getElementById("jsonOutput")
};

init();

async function init() {
  ensureDefaultConfig();
  bindEvents();
  reloadConfigSelect(true);
  renderStatus(elements.status, "Bereit", "info");
  await reloadViewSelect({ preferredViewId: getViewIdFromUrl() });
  applySearchFromUrl();
}

function ensureDefaultConfig() {
  const existing = getAllConfigs();
  if (!existing.length) {
    saveConfig(DEFAULT_CONFIG);
  }

  state.activeConfigId = getActiveConfigId();
  if (!getConfigById(state.activeConfigId)) {
    const created = saveConfig(DEFAULT_CONFIG);
    state.activeConfigId = created.id;
  }
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", handleSearchSubmit);

  elements.copyQueryUrlButton.addEventListener("click", async () => {
    if (!state.lastRequestUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.lastRequestUrl);
      renderStatus(elements.status, "Search Query URL in Zwischenablage kopiert.", "success");
    } catch {
      renderStatus(elements.status, "Kopieren fehlgeschlagen. Browser-Berechtigung pruefen.", "warn");
    }
  });

  elements.openJsonButton.addEventListener("click", () => {
    if (!state.lastPayload) {
      return;
    }

    elements.jsonOutput.textContent = JSON.stringify(state.lastPayload, null, 2);
    elements.jsonDialog.showModal();
  });

  elements.configSelect.addEventListener("change", (event) => {
    const selectedId = event.target.value;
    if (!selectedId) {
      return;
    }

    setActiveConfigId(selectedId);
    state.activeConfigId = selectedId;
    applyLanguageFromActiveConfig(true);
    renderStatus(elements.status, "Aktive Konfiguration gewechselt.", "success");
    void reloadViewSelect({ preferredViewId: "" });
  });
}

function reloadConfigSelect(forceLanguageSync = false) {
  const configs = getAllConfigs();
  elements.configSelect.innerHTML = "";

  configs
    .slice()
    .sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt))
    .forEach((cfg) => {
      const option = document.createElement("option");
      option.value = cfg.id;
      option.textContent = `${cfg.name} [${cfg.environment.toUpperCase()}]`;
      elements.configSelect.appendChild(option);
    });

  const validActive = getConfigById(state.activeConfigId) ? state.activeConfigId : configs[0]?.id;
  if (validActive) {
    elements.configSelect.value = validActive;
    state.activeConfigId = validActive;
    setActiveConfigId(validActive);
    applyLanguageFromActiveConfig(forceLanguageSync);
  }
}

function applyLanguageFromActiveConfig(force = false) {
  const activeConfig = getConfigById(state.activeConfigId);
  if (!activeConfig) {
    return;
  }

  const currentLanguageValue = String(elements.languageInput.value || "").trim();
  if (!force && currentLanguageValue) {
    return;
  }

  elements.languageInput.value = String(activeConfig.language || "").trim();
}

async function handleSearchSubmit(event) {
  event.preventDefault();

  const resultsPerPage = normalizeResultsPerPage(elements.resultsPerPageInput.value);
  const viewId = String(elements.viewSelect.value || "").trim();
  const identifierValues = parseIdentifiers(elements.identifierInput.value);
  const filters = buildIdentifierFilter(identifierValues);
  elements.resultsPerPageInput.value = String(resultsPerPage);
  elements.identifierInput.value = identifierValues.join("\n");

  await executeSearch(
    String(elements.searchInput.value || "").trim(),
    String(elements.languageInput.value || "").trim(),
    resultsPerPage,
    filters,
    viewId,
    Boolean(elements.publishCheckbox?.checked)
  );
}

async function executeSearch(searchText, language, resultsPerPage, filters = "", viewId = "", publish = false) {
  const activeConfig = getConfigById(state.activeConfigId);
  if (!activeConfig) {
    renderStatus(elements.status, "Keine aktive Konfiguration gefunden.", "error");
    return;
  }

  elements.searchButton.disabled = true;
  renderStatus(elements.status, "Suche wird ausgefuehrt...", "info");

  try {
    const { json, requestUrl } = await fetchSearchResults(activeConfig, {
      searchText,
      language,
      resultsPerPage,
      filters,
      viewId,
      publish
    });
    state.lastPayload = json;
    state.lastRequestUrl = requestUrl;
    elements.searchQueryUrl.value = requestUrl;
    elements.copyQueryUrlButton.disabled = false;

    const values = extractValues(json);
    const totalCount = extractTotalCount(json);
    renderResults(values, totalCount);
    elements.openJsonButton.disabled = false;

    markConfigAsUsed(activeConfig.id);
    reloadConfigSelect(false);

    renderStatus(elements.status, "Suche erfolgreich abgeschlossen.", "success");
  } catch (error) {
    state.lastPayload = null;
    state.lastRequestUrl = "";
    elements.searchQueryUrl.value = "";
    elements.copyQueryUrlButton.disabled = true;
    renderEmptyResults("Suche fehlgeschlagen.");
    elements.openJsonButton.disabled = true;
    renderStatus(elements.status, error.message || "Unbekannter Fehler.", "error");
  } finally {
    elements.searchButton.disabled = false;
  }
}

function applySearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const searchText = String(params.get("searchText") || "").trim();
  const language = String(params.get("language") || "").trim();
  const filters = String(params.get("filters") || "").trim();
  const viewId = String(params.get("viewId") || "").trim();
  const hasResultsPerPage = params.has("resultsPerPage");
  const hasSearchText = params.has("searchText");
  const hasLanguage = params.has("language");
  const hasFilters = params.has("filters");
  const hasViewId = params.has("viewId");
  const hasPublish = params.has("publish");
  const publish = String(params.get("publish") || "").trim().toLowerCase() === "true";
  const resultsPerPage = normalizeResultsPerPage(
    hasResultsPerPage ? params.get("resultsPerPage") : elements.resultsPerPageInput.value
  );

  elements.resultsPerPageInput.value = String(resultsPerPage);

  if (!hasSearchText && !hasLanguage && !hasResultsPerPage && !hasFilters && !hasViewId && !hasPublish) {
    return;
  }

  elements.searchInput.value = searchText;
  if (language) {
    elements.languageInput.value = language;
  }
  const filterIdentifiers = parseIdentifiersFromFilter(filters);
  if (filterIdentifiers.length) {
    elements.identifierInput.value = filterIdentifiers.join("\n");
  }
  if (hasViewId) {
    elements.viewSelect.value = viewId;
  }
  elements.publishCheckbox.checked = publish;

  void executeSearch(
    searchText,
    String(elements.languageInput.value || "").trim(),
    resultsPerPage,
    filters,
    viewId,
    publish
  );
}

function getViewIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("viewId") || "").trim();
}

async function reloadViewSelect({ preferredViewId = "" } = {}) {
  const activeConfig = getConfigById(state.activeConfigId);
  const requestId = ++state.viewLoadRequestId;

  if (!activeConfig) {
    setViewSelectState([], { placeholder: "Keine aktive Konfiguration.", disabled: true });
    return;
  }

  if (!String(activeConfig.apiKey || "").trim()) {
    setViewSelectState([], { placeholder: "API-Key fehlt fuer View-Auswahl.", disabled: true });
    return;
  }

  if (!String(activeConfig.project || "").trim()) {
    setViewSelectState([], { placeholder: "Projekt fehlt fuer View-Auswahl.", disabled: true });
    return;
  }

  setViewSelectState([], { placeholder: "Views werden geladen...", disabled: true });

  try {
    const { json } = await fetchSearchViews(activeConfig, {
      select: "identifier,name,description"
    });

    if (requestId !== state.viewLoadRequestId) {
      return;
    }

    const views = normalizeViews(json)
      .filter((entry) => String(entry?.identifier || "").trim())
      .sort((left, right) => {
        const leftName = String(left?.name || left?.identifier || "").toLowerCase();
        const rightName = String(right?.name || right?.identifier || "").toLowerCase();
        return leftName.localeCompare(rightName, "de");
      });

    setViewSelectState(views, { preferredViewId, disabled: false });
  } catch (error) {
    if (requestId !== state.viewLoadRequestId) {
      return;
    }

    setViewSelectState([], { placeholder: "Views konnten nicht geladen werden.", disabled: true });
    renderStatus(
      elements.status,
      `${error.message || "View-Liste konnte nicht geladen werden."} Suche ohne View bleibt moeglich.`,
      "warn"
    );
  }
}

function normalizeViews(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.values)) {
    return payload.values;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function setViewSelectState(views, options = {}) {
  const preferredViewId = String(options.preferredViewId || "").trim();
  const placeholder = String(options.placeholder || "Keine View").trim();
  const disabled = Boolean(options.disabled);

  elements.viewSelect.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  elements.viewSelect.appendChild(emptyOption);

  views.forEach((entry) => {
    const identifier = String(entry?.identifier || "").trim();
    if (!identifier) {
      return;
    }

    const option = document.createElement("option");
    option.value = identifier;
    option.textContent = formatViewOptionLabel(entry);
    elements.viewSelect.appendChild(option);
  });

  elements.viewSelect.disabled = disabled;
  elements.viewSelect.value = preferredViewId;

  if (elements.viewSelect.value !== preferredViewId) {
    elements.viewSelect.value = "";
  }
}

function formatViewOptionLabel(entry) {
  const name = String(entry?.name || "").trim();
  const identifier = String(entry?.identifier || "").trim();

  if (name && identifier) {
    return `${name} [${identifier}]`;
  }

  return name || identifier || "Unbenannte View";
}

function parseIdentifiers(rawInput) {
  return String(rawInput || "")
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

function buildIdentifierFilter(identifiers) {
  if (!Array.isArray(identifiers) || !identifiers.length) {
    return "";
  }

  return identifiers
    .map((id) => `identifier eq '${escapeODataString(id)}'`)
    .join(" or ");
}

function parseIdentifiersFromFilter(filterText) {
  const identifiers = [];
  const regex = /identifier\s+eq\s+'((?:[^']|'{2})+)'/gi;
  let match = regex.exec(String(filterText || ""));

  while (match) {
    identifiers.push(match[1].replace(/''/g, "'"));
    match = regex.exec(String(filterText || ""));
  }

  return identifiers;
}

function normalizeResultsPerPage(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return parsed;
}

function extractValues(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.values)) {
    return payload.values;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function extractTotalCount(payload) {
  const rawCount = payload?.count;
  if (typeof rawCount === "number" && Number.isFinite(rawCount)) {
    return rawCount;
  }
  return null;
}

function renderResults(values, totalCount = null) {
  elements.resultsList.innerHTML = "";

  if (!values.length) {
    renderEmptyResults("Keine Treffer gefunden.", totalCount);
    return;
  }

  const fragment = document.createDocumentFragment();

  values.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "search-result-item";

    const identifier = String(entry?.identifier || "").trim();
    const objectAtId = String(entry?.["@id"] || "").trim();
    const title = String(entry?.name || identifier || objectAtId || `Treffer ${index + 1}`);
    const additionalType = String(entry?.additionalType || entry?.type || "").trim();
    const datasource = Array.isArray(entry?.datasource)
      ? entry.datasource.join(", ")
      : String(entry?.datasource || "").trim();

    const detail = buildDetailTarget(entry);

    if (detail.url) {
      const link = document.createElement("a");
      link.href = detail.url;
      link.className = "search-result-link";
      link.textContent = title;
      item.appendChild(link);
    } else {
      const span = document.createElement("span");
      span.textContent = title;
      item.appendChild(span);
    }

    const meta = document.createElement("p");
    meta.className = "tag-line";
    meta.textContent = [
      additionalType || null,
      identifier ? `ID: ${identifier}` : null,
      datasource ? `Quelle: ${datasource}` : null
    ]
      .filter(Boolean)
      .join(" • ");

    if (meta.textContent) {
      item.appendChild(meta);
    }

    fragment.appendChild(item);
  });

  elements.resultsList.appendChild(fragment);
  elements.resultCount.textContent =
    totalCount !== null ? `${values.length} von ${totalCount}` : `${values.length} Treffer`;
}

function renderEmptyResults(message, totalCount = null) {
  elements.resultsList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = message;
  elements.resultsList.appendChild(item);
  elements.resultCount.textContent =
    totalCount !== null ? `0 von ${totalCount}` : "0 Treffer";
}

function buildDetailTarget(entry) {
  const identifier = String(entry?.identifier || "").trim();
  const objectAtId = String(entry?.["@id"] || "").trim();

  let id = identifier;
  let endpoint = "";

  if (objectAtId) {
    const cleaned = objectAtId.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
    const segments = cleaned.split("/").filter(Boolean);

    if (segments.length >= 2) {
      endpoint = segments[segments.length - 2];
      if (!id) {
        id = segments[segments.length - 1];
      }
    }
  }

  if (!id) {
    return { url: "" };
  }

  const url = new URL("index.html", window.location.href);
  url.searchParams.set("id", id);
  if (endpoint) {
    url.searchParams.set("endpoint", endpoint);
  }

  return { url: `${url.pathname}${url.search}` };
}
