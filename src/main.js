import { API_BASE_URLS, DEFAULT_CONFIG, ENDPOINTS } from "./modules/constants.js";
import {
  deleteConfig,
  exportConfigs,
  getActiveConfigId,
  getAllConfigs,
  getConfigById,
  importConfigsFromText,
  markConfigAsUsed,
  saveConfig,
  setActiveConfigId
} from "./modules/configStore.js";
import { fetchObjectById } from "./modules/api.js";
import {
  renderAccommodationSection,
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
  fetchButton: document.getElementById("fetchButton"),
  status: document.getElementById("status"),

  configForm: document.getElementById("configForm"),
  configSelect: document.getElementById("configSelect"),
  configName: document.getElementById("configName"),
  configEnv: document.getElementById("configEnv"),
  configBaseUrl: document.getElementById("configBaseUrl"),
  configProject: document.getElementById("configProject"),
  configLanguage: document.getElementById("configLanguage"),

  saveConfigButton: document.getElementById("saveConfigButton"),
  newConfigButton: document.getElementById("newConfigButton"),
  deleteConfigButton: document.getElementById("deleteConfigButton"),
  loadConfigButton: document.getElementById("loadConfigButton"),
  exportConfigButton: document.getElementById("exportConfigButton"),
  importConfigButton: document.getElementById("importConfigButton"),
  importConfigInput: document.getElementById("importConfigInput"),

  objectMeta: document.getElementById("objectMeta"),
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
  reloadConfigSelect();
  loadConfigToForm(state.activeConfigId);
  clearResultSections();
  renderStatus(elements.status, "Bereit", "info");
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

  elements.saveConfigButton.addEventListener("click", handleSaveConfig);
  elements.newConfigButton.addEventListener("click", () => {
    elements.configSelect.value = "";
    elements.configName.value = "";
    elements.configEnv.value = "test";
    elements.configBaseUrl.value = API_BASE_URLS.test;
    elements.configProject.value = "tso-test";
    elements.configLanguage.value = "";
    renderStatus(elements.status, "Neue Konfiguration kann jetzt gespeichert werden.", "info");
  });
  elements.deleteConfigButton.addEventListener("click", handleDeleteConfig);
  elements.loadConfigButton.addEventListener("click", () => {
    const selectedId = elements.configSelect.value;
    if (!selectedId) {
      renderStatus(elements.status, "Bitte zuerst eine Konfiguration auswaehlen.", "warn");
      return;
    }
    loadConfigToForm(selectedId);
    renderStatus(elements.status, "Konfiguration geladen.", "success");
  });

  elements.configSelect.addEventListener("change", (event) => {
    const selectedId = event.target.value;
    if (selectedId) {
      setActiveConfigId(selectedId);
      state.activeConfigId = selectedId;
    }
  });

  elements.configEnv.addEventListener("change", () => {
    elements.configBaseUrl.value =
      elements.configEnv.value === "prod" ? API_BASE_URLS.prod : API_BASE_URLS.test;
  });

  elements.exportConfigButton.addEventListener("click", handleExportConfigs);
  elements.importConfigButton.addEventListener("click", () => elements.importConfigInput.click());
  elements.importConfigInput.addEventListener("change", handleImportConfigs);

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
}

function fillEndpointOverride() {
  ENDPOINTS.forEach((endpoint) => {
    const option = document.createElement("option");
    option.value = endpoint;
    option.textContent = endpoint;
    elements.endpointOverride.appendChild(option);
  });
}

async function handleSearchSubmit(event) {
  event.preventDefault();

  const activeConfig = getConfigById(state.activeConfigId);
  if (!activeConfig) {
    renderStatus(elements.status, "Keine aktive Konfiguration gefunden.", "error");
    return;
  }

  const rawInput = elements.objectInput.value;
  const endpointOverride = elements.endpointOverride.value;

  let parsed;
  try {
    parsed = parseObjectInput(rawInput, endpointOverride);
  } catch (error) {
    renderStatus(elements.status, error.message, "error");
    return;
  }

  elements.fetchButton.disabled = true;
  renderStatus(elements.status, "Lade Daten...", "info");

  try {
    const { json, requestUrl } = await fetchObjectById(activeConfig, parsed.endpoint, parsed.id);
    state.lastPayload = json;

    renderObjectMeta(elements.objectMeta, {
      endpoint: parsed.endpoint,
      id: parsed.id,
      source: parsed.source,
      requestUrl
    });

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

function collectConfigFormValues() {
  const selectedId = elements.configSelect.value;
  return {
    id: selectedId || undefined,
    name: elements.configName.value,
    environment: elements.configEnv.value,
    baseUrl: elements.configBaseUrl.value,
    project: elements.configProject.value,
    language: elements.configLanguage.value
  };
}

function handleSaveConfig() {
  const values = collectConfigFormValues();

  if (!values.name || !values.baseUrl || !values.project) {
    renderStatus(elements.status, "Name, Base URL und Project sind erforderlich.", "warn");
    return;
  }

  const saved = saveConfig(values);
  state.activeConfigId = saved.id;
  reloadConfigSelect();
  loadConfigToForm(saved.id);

  renderStatus(elements.status, "Konfiguration gespeichert.", "success");
}

function handleDeleteConfig() {
  const selectedId = elements.configSelect.value;
  if (!selectedId) {
    renderStatus(elements.status, "Bitte zuerst eine Konfiguration waehlen.", "warn");
    return;
  }

  deleteConfig(selectedId);
  reloadConfigSelect();

  const newActive = getActiveConfigId();
  state.activeConfigId = newActive;
  loadConfigToForm(newActive);
  renderStatus(elements.status, "Konfiguration geloescht.", "success");
}

function loadConfigToForm(configId) {
  const cfg = getConfigById(configId);
  if (!cfg) {
    return;
  }

  state.activeConfigId = cfg.id;
  setActiveConfigId(cfg.id);

  elements.configSelect.value = cfg.id;
  elements.configName.value = cfg.name;
  elements.configEnv.value = cfg.environment;
  elements.configBaseUrl.value = cfg.baseUrl;
  elements.configProject.value = cfg.project;
  elements.configLanguage.value = cfg.language || "";
}

function reloadConfigSelect() {
  const configs = getAllConfigs();

  elements.configSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Neue Konfiguration erstellen --";
  elements.configSelect.appendChild(placeholder);

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
  } else {
    elements.configSelect.value = "";
  }
}

function handleExportConfigs() {
  const data = exportConfigs();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "discoverswiss-configs.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  renderStatus(elements.status, "Konfigurationen exportiert.", "success");
}

async function handleImportConfigs(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const imported = importConfigsFromText(text);
    state.activeConfigId = imported[0].id;
    reloadConfigSelect();
    loadConfigToForm(state.activeConfigId);
    renderStatus(elements.status, "Konfigurationen importiert.", "success");
  } catch (error) {
    renderStatus(elements.status, error.message, "error");
  } finally {
    event.target.value = "";
  }
}

function clearResultSections() {
  elements.objectMeta.innerHTML = "";
  elements.mediaSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.accommodationSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.linksSection.innerHTML = '<p class="muted">Noch keine Daten geladen.</p>';
  elements.openJsonButton.disabled = true;
  elements.copyJsonButton.disabled = true;
  state.lastPayload = null;
}
