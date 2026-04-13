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
  renderDataGovernanceSection,
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
  jsonSearchTerm: "",
  monacoEditor: null,
  monacoReadyPromise: null,
  monacoSearchDecorations: []
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
  dataGovernanceSection: document.getElementById("dataGovernanceSection"),

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

  elements.openJsonButton.addEventListener("click", async () => {
    if (!state.lastPayload) {
      return;
    }
    state.jsonSearchTerm = "";
    elements.jsonSearchInput.value = "";
    try {
      await renderJsonViewer(state.lastPayload, "");
      elements.jsonDialog.showModal();
      state.monacoEditor?.layout();
    } catch (error) {
      renderStatus(elements.status, error.message || "Monaco konnte nicht geladen werden.", "error");
    }
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
    void runMonacoSearch(state.jsonSearchTerm).catch(() => {
      elements.jsonSearchInfo.textContent = "Suche aktuell nicht verfuegbar.";
    });
  });

  elements.expandJsonButton.addEventListener("click", () => {
    void setAllJsonNodesOpen(true);
  });

  elements.collapseJsonButton.addEventListener("click", () => {
    void setAllJsonNodesOpen(false);
  });

  elements.jsonDialog.addEventListener("close", () => {
    state.monacoEditor?.setScrollTop(0);
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
    renderDataGovernanceSection(elements.dataGovernanceSection, json);

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
  elements.dataGovernanceSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  if (elements.queryUrl) {
    elements.queryUrl.value = "";
    elements.copyQueryUrlButton.disabled = true;
  }
  elements.openJsonButton.disabled = true;
  elements.copyJsonButton.disabled = true;
  state.lastPayload = null;
  state.jsonSearchTerm = "";
  if (state.monacoEditor?.getModel()) {
    state.monacoEditor.getModel().setValue("");
  } else {
    elements.jsonOutput.innerHTML = "";
  }
  elements.jsonSearchInput.value = "";
  elements.jsonSearchInfo.textContent = "Noch keine Suche aktiv.";
}

async function renderJsonViewer(payload, searchTerm = "") {
  const editor = await ensureMonacoEditor();
  const jsonString = JSON.stringify(payload, null, 2);
  editor.getModel().setValue(jsonString);
  await setAllJsonNodesOpen(true);
  await runMonacoSearch(searchTerm);
}

async function ensureMonacoEditor() {
  if (state.monacoEditor) {
    return state.monacoEditor;
  }

  if (!state.monacoReadyPromise) {
    state.monacoReadyPromise = new Promise((resolve, reject) => {
      if (!window.require || typeof window.require.config !== "function") {
        reject(new Error("Monaco Loader wurde nicht geladen."));
        return;
      }

      window.require.config({
        paths: {
          vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs"
        }
      });

      window.require(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
    });
  }

  const monaco = await state.monacoReadyPromise;
  const model = monaco.editor.createModel("", "json");
  state.monacoEditor = monaco.editor.create(elements.jsonOutput, {
    model,
    readOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: "on",
    folding: true,
    scrollBeyondLastLine: false,
    wordWrap: "off",
    tabSize: 2,
    renderWhitespace: "none",
    contextmenu: true,
    theme: "vs"
  });

  return state.monacoEditor;
}

async function runMonacoSearch(searchTerm) {
  const editor = await ensureMonacoEditor();
  const model = editor.getModel();
  if (!model) {
    return;
  }

  state.monacoSearchDecorations = editor.deltaDecorations(state.monacoSearchDecorations, []);
  const term = String(searchTerm || "").trim();

  if (!term) {
    elements.jsonSearchInfo.textContent = "Noch keine Suche aktiv.";
    return;
  }

  const matches = model.findMatches(term, true, false, false, null, false, 9999);

  if (!matches.length) {
    elements.jsonSearchInfo.textContent = `Keine Treffer fuer "${term}".`;
    return;
  }

  state.monacoSearchDecorations = editor.deltaDecorations(
    state.monacoSearchDecorations,
    matches.map((match) => ({
      range: match.range,
      options: { inlineClassName: "json-monaco-find" }
    }))
  );

  editor.setSelection(matches[0].range);
  editor.revealRangeInCenter(matches[0].range);
  elements.jsonSearchInfo.textContent = `${matches.length} Treffer fuer "${term}".`;
}

async function setAllJsonNodesOpen(open) {
  const editor = await ensureMonacoEditor();
  const action = editor.getAction(open ? "editor.unfoldAll" : "editor.foldAll");
  if (action) {
    await action.run();
  }
}
