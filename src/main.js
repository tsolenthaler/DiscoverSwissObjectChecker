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
  renderPotentialActionSection,
  renderStatus
} from "./modules/renderers.js";
import { parseObjectInput } from "./modules/utils.js";

const state = {
  activeConfigId: null,
  lastPayload: null,
  jsonSearchTerm: ""
};

const elements = {
  searchForm: document.getElementById("searchForm"),
  objectInput: document.getElementById("objectInput"),
  endpointOverride: document.getElementById("endpointOverride"),
  scopeInput: document.getElementById("scopeInput"),
  languageInput: document.getElementById("languageInput"),
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
  potentialActionSection: document.getElementById("potentialActionSection"),

  queryUrl: document.getElementById("queryUrl"),
  copyQueryUrlButton: document.getElementById("copyQueryUrlButton"),
  openJsonButton: document.getElementById("openJsonButton"),
  copyJsonButton: document.getElementById("copyJsonButton"),
  jsonDialog: document.getElementById("jsonDialog"),
  jsonOutput: document.getElementById("jsonOutput"),
  jsonSearchInput: document.getElementById("jsonSearchInput"),
  jsonSearchInfo: document.getElementById("jsonSearchInfo"),
  expandJsonButton: document.getElementById("expandJsonButton"),
  collapseJsonButton: document.getElementById("collapseJsonButton")
};

init();

function init() {
  fillEndpointOverride();
  ensureDefaultConfig();
  bindEvents();
  initializeTabs();
  reloadConfigSelect(true);
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

  elements.copyQueryUrlButton.addEventListener("click", async () => {
    if (!elements.queryUrl.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(elements.queryUrl.value);
      renderStatus(elements.status, "Query URL in Zwischenablage kopiert.", "success");
    } catch {
      renderStatus(elements.status, "Kopieren fehlgeschlagen. Browser-Berechtigung pruefen.", "warn");
    }
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

  elements.openJsonButton.addEventListener("click", () => {
    if (!state.lastPayload) {
      return;
    }
    state.jsonSearchTerm = "";
    elements.jsonSearchInput.value = "";
    renderJsonViewer(state.lastPayload, "");
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

  elements.jsonSearchInput.addEventListener("input", () => {
    if (!state.lastPayload) {
      return;
    }
    state.jsonSearchTerm = String(elements.jsonSearchInput.value || "").trim();
    renderJsonViewer(state.lastPayload, state.jsonSearchTerm);
  });

  elements.expandJsonButton.addEventListener("click", () => {
    setAllJsonNodesOpen(true);
  });

  elements.collapseJsonButton.addEventListener("click", () => {
    setAllJsonNodesOpen(false);
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
    elements.objectInput.value,
    elements.endpointOverride.value,
    elements.scopeInput.value,
    elements.languageInput.value
  );
}

async function executeSearch(rawInput, endpointOverride = "", scopeInput = "", languageInput = "") {

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
  const normalizedLanguage = String(languageInput || "").trim();
  syncSearchParams(parsed.id, endpointOverride || "", normalizedScope, normalizedLanguage);

  elements.fetchButton.disabled = true;
  renderStatus(elements.status, "Lade Daten...", "info");

  try {
    const { json, requestUrl } = await fetchObjectById(
      activeConfig,
      parsed.endpoint,
      parsed.id,
      { scope: normalizedScope, language: normalizedLanguage }
    );
    state.lastPayload = json;

    renderObjectMeta(elements.objectMeta, {
      endpoint: parsed.endpoint,
      id: parsed.id,
      name: json?.name || "",
      source: parsed.source,
      requestUrl,
      objectAtId: json?.["@id"] || "",
      environment: activeConfig.environment
    });

    renderDescriptionSection(elements.descriptionSection, json);
    renderMediaSection(elements.mediaSection, json);
    renderAccommodationSection(elements.accommodationSection, json);
    renderLinksSection(elements.linksSection, json);
    renderPotentialActionSection(elements.potentialActionSection, json);

    elements.queryUrl.value = requestUrl;
    elements.copyQueryUrlButton.disabled = false;
    elements.openJsonButton.disabled = false;
    elements.copyJsonButton.disabled = false;

    markConfigAsUsed(activeConfig.id);
    reloadConfigSelect(false);

    renderStatus(elements.status, "Daten erfolgreich geladen.", "success");
  } catch (error) {
    clearResultSections();
    renderStatus(elements.status, error.message || "Unbekannter Fehler.", "error");
  } finally {
    elements.fetchButton.disabled = false;
  }
}

function syncSearchParams(id, endpointOverride, scope, language) {
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

  if (language) {
    url.searchParams.set("language", language);
  } else {
    url.searchParams.delete("language");
  }

  window.history.replaceState({}, "", url);
}

function applySearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get("id");
  const queryEndpoint = params.get("endpoint");
  const queryScope = params.get("scope");
  const queryLanguage = params.get("language");

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

  if (queryLanguage !== null) {
    elements.languageInput.value = queryLanguage;
  }

  void executeSearch(
    queryId,
    elements.endpointOverride.value,
    elements.scopeInput.value,
    elements.languageInput.value
  );
}

function clearResultSections() {
  elements.objectMeta.innerHTML = "";
  elements.descriptionSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.mediaSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.accommodationSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  const accommodationTitle = document.querySelector('[data-panel="accommodation"] h3');
  if (accommodationTitle) {
    accommodationTitle.textContent = "Accommodation (0)";
  }
  elements.linksSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.potentialActionSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  if (elements.queryUrl) {
    elements.queryUrl.value = "";
    elements.copyQueryUrlButton.disabled = true;
  }
  elements.openJsonButton.disabled = true;
  elements.copyJsonButton.disabled = true;
  state.lastPayload = null;
  state.jsonSearchTerm = "";
  elements.jsonOutput.innerHTML = "";
  elements.jsonSearchInput.value = "";
  elements.jsonSearchInfo.textContent = "Noch keine Suche aktiv.";
}

function renderJsonViewer(payload, searchTerm = "") {
  elements.jsonOutput.innerHTML = "";

  const normalizedTerm = String(searchTerm || "").trim().toLowerCase();
  const context = {
    normalizedTerm,
    hasSearch: Boolean(normalizedTerm),
    matches: 0
  };

  const root = renderJsonNode(payload, null, "$", context, 0, true, "root");
  if (root) {
    elements.jsonOutput.appendChild(root);
  }

  if (!context.hasSearch) {
    elements.jsonSearchInfo.textContent = "Noch keine Suche aktiv.";
    return;
  }

  if (context.matches === 0) {
    elements.jsonSearchInfo.textContent = `Keine Treffer fuer "${searchTerm}".`;
  } else {
    elements.jsonSearchInfo.textContent = `${context.matches} Treffer fuer "${searchTerm}".`;
  }
}

function renderJsonNode(value, key, path, context, depth, isLast = true, parentType = "object") {
  const type = getJsonValueType(value);

  if (type === "object" || type === "array") {
    const details = document.createElement("details");
    details.className = "json-node";
    details.dataset.path = path;

    const summary = document.createElement("summary");
    summary.className = "json-summary";
    if (key !== null && key !== undefined && parentType === "object") {
      const keyEl = document.createElement("span");
      keyEl.className = "json-key";
      keyEl.textContent = `"${key}"`;
      summary.appendChild(keyEl);
      summary.appendChild(document.createTextNode(": "));
    }

    const openToken = document.createElement("span");
    openToken.className = "json-punctuation";
    openToken.textContent = type === "array" ? "[" : "{";
    summary.appendChild(openToken);

    summary.appendChild(document.createTextNode(" "));

    const typeEl = document.createElement("span");
    typeEl.className = "json-type json-preview";
    const size = type === "array" ? value.length : Object.keys(value || {}).length;
    typeEl.textContent = `${size} ${size === 1 ? "Eintrag" : "Eintraege"}`;
    summary.appendChild(typeEl);

    summary.appendChild(document.createTextNode(" "));
    const closeToken = document.createElement("span");
    closeToken.className = "json-punctuation";
    closeToken.textContent = type === "array" ? "]" : "}";
    summary.appendChild(closeToken);

    if (!isLast) {
      const commaEl = document.createElement("span");
      commaEl.className = "json-punctuation";
      commaEl.textContent = ",";
      summary.appendChild(commaEl);
    }

    details.appendChild(summary);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "json-children";

    const entries = type === "array"
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value || {});

    let hasDescendantMatch = false;
    entries.forEach(([childKey, childValue], index) => {
      const childPath = type === "array" ? `${path}[${childKey}]` : `${path}.${childKey}`;
      const childNode = renderJsonNode(
        childValue,
        childKey,
        childPath,
        context,
        depth + 1,
        index === entries.length - 1,
        type
      );
      if (!childNode) {
        return;
      }
      if (childNode.dataset.matches === "true") {
        hasDescendantMatch = true;
      }
      childrenWrap.appendChild(childNode);
    });

    details.appendChild(childrenWrap);

    const keyMatch = context.hasSearch
      && parentType === "object"
      && String(key).toLowerCase().includes(context.normalizedTerm);
    const valueMatch = context.hasSearch
      && `${type} ${size}`.toLowerCase().includes(context.normalizedTerm);
    const selfMatches = Boolean(keyMatch || valueMatch);
    const nodeMatches = selfMatches || hasDescendantMatch;

    details.dataset.matches = nodeMatches ? "true" : "false";
    if (context.hasSearch) {
      details.classList.toggle("json-node-match", selfMatches);
      details.classList.toggle("json-node-context", !selfMatches && hasDescendantMatch);
      details.open = nodeMatches;
      if (selfMatches) {
        context.matches += 1;
      }
      if (keyMatch) {
        summary.classList.add("json-highlight");
      }
    } else {
      details.open = depth <= 1;
    }

    return details;
  }

  const row = document.createElement("div");
  row.className = "json-row";
  row.dataset.path = path;

  let keyEl = null;
  if (parentType === "object") {
    keyEl = document.createElement("span");
    keyEl.className = "json-key";
    keyEl.textContent = `"${key}"`;
    row.appendChild(keyEl);

    const sep = document.createElement("span");
    sep.className = "json-punctuation";
    sep.textContent = ": ";
    row.appendChild(sep);
  }

  const valueEl = document.createElement("span");
  const valueString = stringifyJsonValue(value);
  valueEl.className = `json-value json-${type}`;
  valueEl.textContent = valueString;
  row.appendChild(valueEl);

  if (!isLast) {
    const commaEl = document.createElement("span");
    commaEl.className = "json-punctuation";
    commaEl.textContent = ",";
    row.appendChild(commaEl);
  }

  const keyMatch = context.hasSearch
    && parentType === "object"
    && String(key).toLowerCase().includes(context.normalizedTerm);
  const valueMatch = context.hasSearch && valueString.toLowerCase().includes(context.normalizedTerm);
  const isMatch = Boolean(keyMatch || valueMatch);
  row.dataset.matches = isMatch ? "true" : "false";

  if (context.hasSearch && isMatch) {
    row.classList.add("json-row-match");
    context.matches += 1;
    if (keyMatch && keyEl) {
      keyEl.classList.add("json-highlight");
    }
    if (valueMatch) {
      valueEl.classList.add("json-highlight");
    }
  }

  return row;
}

function getJsonValueType(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "unknown";
}

function stringifyJsonValue(value) {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

function setAllJsonNodesOpen(open) {
  const nodes = elements.jsonOutput.querySelectorAll("details.json-node");
  nodes.forEach((node) => {
    node.open = open;
  });
}
