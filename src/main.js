import { DEFAULT_CONFIG, ENDPOINTS } from "./modules/constants.js";
import {
  getActiveConfigId,
  getAllConfigs,
  getConfigById,
  markConfigAsUsed,
  saveConfig,
  setActiveConfigId
} from "./modules/configStore.js";
import { fetchObjectById } from "./modules/api.js";
import {
  renderAccommodationSection,
  renderDescriptionSection,
  renderLinksSection,
  renderMediaSection,
  renderObjectMeta,
  renderStatus
} from "./modules/renderers.js";
import { parseObjectInput } from "./modules/utils.js";

const state = {
  activeConfigId: null,
  lastPayload: null
};

const elements = {
  searchForm: document.getElementById("searchForm"),
  objectInput: document.getElementById("objectInput"),
  endpointOverride: document.getElementById("endpointOverride"),
  scopeInput: document.getElementById("scopeInput"),
  fetchButton: document.getElementById("fetchButton"),
  status: document.getElementById("status"),
  configSelect: document.getElementById("configSelect"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),

  objectMeta: document.getElementById("objectMeta"),
  descriptionSection: document.getElementById("descriptionSection"),
  mediaSection: document.getElementById("mediaSection"),
  accommodationSection: document.getElementById("accommodationSection"),
  linksSection: document.getElementById("linksSection"),

  openJsonButton: document.getElementById("openJsonButton"),
  copyJsonButton: document.getElementById("copyJsonButton"),
  jsonDialog: document.getElementById("jsonDialog"),
  jsonOutput: document.getElementById("jsonOutput")
};

init();

function init() {
  fillEndpointOverride();
  ensureDefaultConfig();
  bindEvents();
  initializeTabs();
  reloadConfigSelect();
  clearResultSections();
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

  elements.configSelect.addEventListener("change", (event) => {
    const selectedId = event.target.value;
    if (!selectedId) {
      return;
    }
    setActiveConfigId(selectedId);
    state.activeConfigId = selectedId;
    renderStatus(elements.status, "Aktive Konfiguration gewechselt.", "success");
  });

  elements.openJsonButton.addEventListener("click", () => {
    if (!state.lastPayload) {
      return;
    }
    elements.jsonOutput.textContent = JSON.stringify(state.lastPayload, null, 2);
    elements.jsonDialog.showModal();
  });

  elements.copyJsonButton.addEventListener("click", async () => {
    if (!state.lastPayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(state.lastPayload, null, 2));
      renderStatus(elements.status, "JSON in Zwischenablage kopiert.", "success");
    } catch {
      renderStatus(elements.status, "Kopieren fehlgeschlagen. Browser-Berechtigung pruefen.", "warn");
    }
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });
}

function initializeTabs() {
  activateTab("meta");
}

function activateTab(tabName) {
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function fillEndpointOverride() {
  ENDPOINTS.forEach((endpoint) => {
    const option = document.createElement("option");
    option.value = endpoint;
    option.textContent = endpoint;
    elements.endpointOverride.appendChild(option);
  });
}

function reloadConfigSelect() {
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
  }
}

async function handleSearchSubmit(event) {
  event.preventDefault();

  await executeSearch(
    elements.objectInput.value,
    elements.endpointOverride.value,
    elements.scopeInput.value
  );
}

async function executeSearch(rawInput, endpointOverride = "", scopeInput = "") {

  const activeConfig = getConfigById(state.activeConfigId);
  if (!activeConfig) {
    renderStatus(elements.status, "Keine aktive Konfiguration gefunden.", "error");
    return;
  }

  let parsed;
  try {
    parsed = parseObjectInput(rawInput, endpointOverride);
  } catch (error) {
    renderStatus(elements.status, error.message, "error");
    return;
  }

  const normalizedScope = String(scopeInput || "").trim();
  syncSearchParams(parsed.id, endpointOverride || "", normalizedScope);

  elements.fetchButton.disabled = true;
  renderStatus(elements.status, "Lade Daten...", "info");

  try {
    const { json, requestUrl } = await fetchObjectById(
      activeConfig,
      parsed.endpoint,
      parsed.id,
      { scope: normalizedScope }
    );
    state.lastPayload = json;

    renderObjectMeta(elements.objectMeta, {
      endpoint: parsed.endpoint,
      id: parsed.id,
      source: parsed.source,
      requestUrl,
      objectAtId: json?.["@id"] || ""
    });

    renderDescriptionSection(elements.descriptionSection, json);
    renderMediaSection(elements.mediaSection, json);
    renderAccommodationSection(elements.accommodationSection, json);
    renderLinksSection(elements.linksSection, json);

    elements.openJsonButton.disabled = false;
    elements.copyJsonButton.disabled = false;

    markConfigAsUsed(activeConfig.id);
    reloadConfigSelect();

    renderStatus(elements.status, "Daten erfolgreich geladen.", "success");
  } catch (error) {
    clearResultSections();
    renderStatus(elements.status, error.message || "Unbekannter Fehler.", "error");
  } finally {
    elements.fetchButton.disabled = false;
  }
}

function syncSearchParams(id, endpointOverride, scope) {
  const url = new URL(window.location.href);
  url.searchParams.set("id", id);

  if (endpointOverride && ENDPOINTS.includes(endpointOverride)) {
    url.searchParams.set("endpoint", endpointOverride);
  } else {
    url.searchParams.delete("endpoint");
  }

  if (scope) {
    url.searchParams.set("scope", scope);
  } else {
    url.searchParams.delete("scope");
  }

  window.history.replaceState({}, "", url);
}

function applySearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("id");
  const queryEndpoint = params.get("endpoint");
  const queryScope = params.get("scope");

  if (!queryId) {
    return;
  }

  elements.objectInput.value = queryId;

  if (queryEndpoint && ENDPOINTS.includes(queryEndpoint)) {
    elements.endpointOverride.value = queryEndpoint;
  }

  if (queryScope) {
    elements.scopeInput.value = queryScope;
  }

  void executeSearch(queryId, elements.endpointOverride.value, elements.scopeInput.value);
}

function clearResultSections() {
  elements.objectMeta.innerHTML = "";
  elements.descriptionSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.mediaSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.accommodationSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.linksSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.openJsonButton.disabled = true;
  elements.copyJsonButton.disabled = true;
  state.lastPayload = null;
}
