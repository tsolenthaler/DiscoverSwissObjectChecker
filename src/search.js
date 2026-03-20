import { DEFAULT_CONFIG } from "./modules/constants.js";
import {
  getActiveConfigId,
  getAllConfigs,
  getConfigById,
  markConfigAsUsed,
  saveConfig,
  setActiveConfigId
} from "./modules/configStore.js";
import { fetchSearchResults } from "./modules/api.js";
import { renderStatus } from "./modules/renderers.js";

const state = {
  activeConfigId: null,
  lastPayload: null,
  lastRequestUrl: ""
};

const elements = {
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  languageInput: document.getElementById("languageInput"),
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

function init() {
  ensureDefaultConfig();
  bindEvents();
  reloadConfigSelect(true);
  renderStatus(elements.status, "Bereit", "info");
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

  await executeSearch(
    String(elements.searchInput.value || "").trim(),
    String(elements.languageInput.value || "").trim()
  );
}

async function executeSearch(searchText, language) {
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
      language
    });
    state.lastPayload = json;
    state.lastRequestUrl = requestUrl;
    elements.searchQueryUrl.value = requestUrl;
    elements.copyQueryUrlButton.disabled = false;

    const values = extractValues(json);
    renderResults(values);
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

  if (!searchText) {
    return;
  }

  elements.searchInput.value = searchText;
  if (language) {
    elements.languageInput.value = language;
  }

  void executeSearch(searchText, String(elements.languageInput.value || "").trim());
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

function renderResults(values) {
  elements.resultsList.innerHTML = "";

  if (!values.length) {
    renderEmptyResults("Keine Treffer gefunden.");
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
  elements.resultCount.textContent = `${values.length} Treffer`;
}

function renderEmptyResults(message) {
  elements.resultsList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = message;
  elements.resultsList.appendChild(item);
  elements.resultCount.textContent = "0 Treffer";
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
