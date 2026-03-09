import { API_BASE_URLS, DEFAULT_CONFIG } from "./modules/constants.js";
import {
  deleteConfig,
  exportConfigs,
  getActiveConfigId,
  getAllConfigs,
  getConfigById,
  importConfigsFromText,
  saveConfig,
  setActiveConfigId
} from "./modules/configStore.js";
import { renderStatus } from "./modules/renderers.js";

const state = {
  activeConfigId: null
};

const elements = {
  configSelect: document.getElementById("configSelect"),
  configName: document.getElementById("configName"),
  configEnv: document.getElementById("configEnv"),
  configBaseUrl: document.getElementById("configBaseUrl"),
  configProject: document.getElementById("configProject"),
  configApiKey: document.getElementById("configApiKey"),
  configLanguage: document.getElementById("configLanguage"),
  status: document.getElementById("status"),

  saveConfigButton: document.getElementById("saveConfigButton"),
  newConfigButton: document.getElementById("newConfigButton"),
  deleteConfigButton: document.getElementById("deleteConfigButton"),
  loadConfigButton: document.getElementById("loadConfigButton"),
  exportConfigButton: document.getElementById("exportConfigButton"),
  importConfigButton: document.getElementById("importConfigButton"),
  importConfigInput: document.getElementById("importConfigInput")
};

init();

function init() {
  ensureDefaultConfig();
  bindEvents();
  reloadConfigSelect();
  loadConfigToForm(state.activeConfigId);
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
  elements.saveConfigButton.addEventListener("click", handleSaveConfig);

  elements.newConfigButton.addEventListener("click", () => {
    elements.configSelect.value = "";
    elements.configName.value = "";
    elements.configEnv.value = "test";
    elements.configBaseUrl.value = API_BASE_URLS.test;
    elements.configProject.value = "tso-test";
    elements.configApiKey.value = "";
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
}

function collectConfigFormValues() {
  const selectedId = elements.configSelect.value;
  return {
    id: selectedId || undefined,
    name: elements.configName.value,
    environment: elements.configEnv.value,
    baseUrl: elements.configBaseUrl.value,
    project: elements.configProject.value,
    apiKey: elements.configApiKey.value,
    language: elements.configLanguage.value
  };
}

function handleSaveConfig() {
  const values = collectConfigFormValues();

  if (!values.name || !values.baseUrl || !values.project || !values.apiKey) {
    renderStatus(
      elements.status,
      "Name, Base URL, Project und API-Key sind erforderlich.",
      "warn"
    );
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
  elements.configApiKey.value = cfg.apiKey || "";
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
