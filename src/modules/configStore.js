import {
  ACTIVE_CONFIG_KEY,
  DEFAULT_CONFIG,
  STORAGE_KEY
} from "./constants.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeConfig(config) {
  return {
    id: config.id || `cfg_${crypto.randomUUID()}`,
    name: String(config.name || "Unbenannte Konfiguration").trim(),
    environment: config.environment === "prod" ? "prod" : "test",
    baseUrl: String(config.baseUrl || "").trim(),
    project: String(config.project || "").trim(),
    language: String(config.language || "").trim(),
    lastUsedAt: config.lastUsedAt || nowIso()
  };
}

function readRawConfigs() {
  try {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (!fromStorage) {
      return [DEFAULT_CONFIG];
    }
    const parsed = JSON.parse(fromStorage);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_CONFIG];
    }
    return parsed.map(normalizeConfig);
  } catch {
    return [DEFAULT_CONFIG];
  }
}

function saveRawConfigs(configs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs, null, 2));
}

export function getAllConfigs() {
  return readRawConfigs();
}

export function getConfigById(configId) {
  return readRawConfigs().find((cfg) => cfg.id === configId) || null;
}

export function saveConfig(inputConfig) {
  const configs = readRawConfigs();
  const normalized = normalizeConfig(inputConfig);
  const index = configs.findIndex((cfg) => cfg.id === normalized.id);

  normalized.lastUsedAt = nowIso();

  if (index >= 0) {
    configs[index] = normalized;
  } else {
    configs.push(normalized);
  }

  saveRawConfigs(configs);
  setActiveConfigId(normalized.id);
  return normalized;
}

export function deleteConfig(configId) {
  const configs = readRawConfigs();
  const filtered = configs.filter((cfg) => cfg.id !== configId);
  saveRawConfigs(filtered.length ? filtered : [DEFAULT_CONFIG]);

  const activeId = getActiveConfigId();
  if (activeId === configId) {
    const fallback = filtered[0] || DEFAULT_CONFIG;
    setActiveConfigId(fallback.id);
  }
}

export function setActiveConfigId(configId) {
  localStorage.setItem(ACTIVE_CONFIG_KEY, configId);
}

export function getActiveConfigId() {
  return localStorage.getItem(ACTIVE_CONFIG_KEY) || DEFAULT_CONFIG.id;
}

export function markConfigAsUsed(configId) {
  const config = getConfigById(configId);
  if (!config) {
    return null;
  }
  return saveConfig({ ...config, lastUsedAt: nowIso() });
}

export function exportConfigs() {
  return JSON.stringify(readRawConfigs(), null, 2);
}

export function importConfigsFromText(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Import fehlgeschlagen: JSON ist ungueltig.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Import fehlgeschlagen: Erwartet wird ein JSON-Array mit Konfigurationen.");
  }

  const normalized = parsed.map(normalizeConfig);
  if (!normalized.length) {
    throw new Error("Import fehlgeschlagen: Keine Konfigurationen enthalten.");
  }

  saveRawConfigs(normalized);
  setActiveConfigId(normalized[0].id);
  return normalized;
}
