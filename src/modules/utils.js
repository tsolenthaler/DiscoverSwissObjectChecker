import { ENDPOINTS, PREFIX_TO_ENDPOINT } from "./constants.js";

export function normalizeIdInput(rawInput) {
  return String(rawInput || "").trim();
}

export function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return [value];
}

export function safeGet(obj, path, fallback = undefined) {
  if (!obj || !path) {
    return fallback;
  }

  const keys = Array.isArray(path) ? path : String(path).split(".");
  let current = obj;

  for (const key of keys) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      current = current[key];
    } else {
      return fallback;
    }
  }

  return current === undefined || current === null ? fallback : current;
}

export function parseObjectInput(input, endpointOverride = "") {
  const normalizedInput = normalizeIdInput(input);
  if (!normalizedInput) {
    throw new Error("Bitte eine Objekt-ID oder einen Pfad eingeben.");
  }

  if (endpointOverride) {
    const id = extractIdFromInput(normalizedInput);
    return {
      endpoint: endpointOverride,
      id,
      source: "manual"
    };
  }

  const asPath = parsePathInput(normalizedInput);
  if (asPath) {
    return asPath;
  }

  const id = extractIdFromInput(normalizedInput);
  const prefix = id.split("_")[0]?.toLowerCase();
  const endpoint = PREFIX_TO_ENDPOINT[prefix];

  if (!endpoint) {
    throw new Error(
      "Endpoint konnte nicht aus der ID erkannt werden. Nutze Pfadformat oder waehle den Endpoint manuell."
    );
  }

  return {
    endpoint,
    id,
    source: "prefix"
  };
}

function parsePathInput(input) {
  const trimmed = input.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/g, "");
  const segments = trimmed.split("/").filter(Boolean);

  if (segments.length >= 2 && ENDPOINTS.includes(segments[0])) {
    return {
      endpoint: segments[0],
      id: segments[1],
      source: "path"
    };
  }

  return null;
}

function extractIdFromInput(input) {
  const cleaned = input.split("?")[0].replace(/\/$/, "");
  const segments = cleaned.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1] : cleaned;
}
