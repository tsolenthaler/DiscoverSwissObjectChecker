import { safeGet, toArray } from "./utils.js";

function fallbackText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export function renderStatus(statusEl, message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status-${type}`;
}

export function renderObjectMeta(container, context) {
  const { endpoint, id, name, lastModified, requestUrl, source, objectAtId, environment } = context;
  const sameAsAtId = compareUrls(requestUrl, objectAtId);
  const infoCenterUrl = buildInfoCenterUrl(environment, id);
  const rows = [
    ["Name", fallbackText(name, "nicht vorhanden")],
    ["lastModified", formatDateTimeReadable(lastModified)],
    ["Infocenter", fallbackText(infoCenterUrl, "nicht vorhanden")],
    ["Objekt-ID", id],
    ["Erkannt via", source],
    ["API Endpoint", endpoint],
    ["API Request URL", requestUrl],
    ["API @id", fallbackText(objectAtId, "nicht vorhanden")],
    ["API Request URL == API @id", sameAsAtId === null ? "-" : (sameAsAtId ? "✅" : "❌")]
  ];

  container.innerHTML = "";

  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");

    if (term === "API Request URL" || term === "Infocenter") {
      const a = document.createElement("a");
      a.href = value;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = value;
      dd.appendChild(a);
    } else {
      dd.textContent = fallbackText(value);
    }

    container.append(dt, dd);
  }
}

function formatDateTimeReadable(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "nicht vorhanden";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} - ${hours}:${minutes}`;
}

function buildInfoCenterUrl(environment, id) {
  const objectId = String(id || "").trim();
  if (!objectId) {
    return "";
  }

  const host = environment === "prod"
    ? "https://partner.discover.swiss"
    : "https://partner-test.discover.swiss";

  return `${host}/infocenter/details/Event/${encodeURIComponent(objectId)}`;
}

function compareUrls(requestUrl, objectAtId) {
  const left = normalizeComparableUrl(requestUrl);
  const right = normalizeComparableUrl(objectAtId);

  if (!left || !right) {
    return null;
  }

  return left === right;
}

function normalizeComparableUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/$/, "");
  }
}

export function renderMediaSection(container, payload) {
  container.innerHTML = "";

  const primary = safeGet(payload, "image", null);
  const gallery = toArray(safeGet(payload, "photo", []));

  const primaryWrap = document.createElement("section");
  primaryWrap.className = "block";
  const primaryTitle = document.createElement("h4");
  primaryTitle.textContent = isPrimaryImageFromCtd(primary)
    ? "Hauptbild (image)"
    : "⚠️ Hauptbild (image)";
  primaryWrap.appendChild(primaryTitle);
  primaryWrap.appendChild(createMediaCard(primary, "Kein Hauptbild vorhanden."));

  const galleryWrap = document.createElement("section");
  galleryWrap.className = "block";
  const galleryTitle = document.createElement("h4");
  galleryTitle.textContent = "Galerie (photo)";
  galleryWrap.appendChild(galleryTitle);

  if (!gallery.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Keine Galerie-Bilder vorhanden.";
    galleryWrap.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "media-grid";
    gallery.forEach((item) => grid.appendChild(createMediaCard(item)));
    galleryWrap.appendChild(grid);
  }

  container.append(primaryWrap, galleryWrap);
}

function isPrimaryImageFromCtd(primaryImage) {
  if (!primaryImage || typeof primaryImage !== "object") {
    return false;
  }

  const dataGovernance = safeGet(primaryImage, "dataGovernance", null);
  if (!dataGovernance || typeof dataGovernance !== "object") {
    return false;
  }

  const checks = [
    dataGovernance?.provider?.acronym,
    dataGovernance?.provider?.identifier,
    dataGovernance?.provider?.name,
    dataGovernance?.source?.acronym,
    dataGovernance?.source?.identifier,
    dataGovernance?.source?.name
  ];

  return checks.some((value) => String(value || "").toLowerCase().includes("ctd"));
}

function buildDataGovernanceEntityTable(value, dataGovernance) {
  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>acronym</th><th>identifier</th><th>type</th><th>name</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const row = document.createElement("tr");

  const acronymCell = document.createElement("td");
  acronymCell.textContent = fallbackText(value?.acronym, "-");

  const identifierCell = document.createElement("td");
  identifierCell.textContent = fallbackText(value?.identifier, "-");

  const typeCell = document.createElement("td");
  typeCell.textContent = fallbackText(value?.type, "-");

  const nameCell = document.createElement("td");
  const nameResult = resolveNameWithProviderFallback(value, dataGovernance);
  nameCell.textContent = nameResult.name;

  row.append(acronymCell, identifierCell, typeCell, nameCell);
  tbody.appendChild(row);

  table.appendChild(tbody);
  return table;
}

export function renderDescriptionSection(container, payload) {
  container.innerHTML = "";

  const shortDescription = safeGet(payload, "disambiguatingDescription", "");
  const description = safeGet(payload, "description", "");

  const list = document.createElement("dl");
  list.className = "meta-grid";

  appendDescriptionRow(
    list,
    "Kurzbeschreibung",
    normalizeDescriptionValue(shortDescription, "Keine Kurzbeschreibung vorhanden.")
  );
  appendDescriptionRow(
    list,
    "Beschreibungs-Text",
    normalizeDescriptionValue(description, "Kein Beschreibungs-Text vorhanden.")
  );

  container.appendChild(list);
}

function appendDescriptionRow(list, label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function normalizeDescriptionValue(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((entry) => String(entry)).join(" | ") : fallback;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function createMediaCard(media, emptyText = "Kein Medium vorhanden.") {
  const card = document.createElement("article");
  card.className = "media-card";

  if (!media || typeof media !== "object") {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = emptyText;
    card.appendChild(p);
    return card;
  }

  const title = document.createElement("h5");
  title.textContent = fallbackText(media.name, "Unbenanntes Medium");
  card.appendChild(title);

  const thumb = document.createElement("img");
  const thumbUrl = safeGet(media, "thumbnailUrl", "");
  thumb.src = thumbUrl || "";
  thumb.alt = fallbackText(media.name, "Medium Vorschau");
  thumb.loading = "lazy";

  if (thumbUrl) {
    card.appendChild(thumb);
  } else {
    const missingThumb = document.createElement("p");
    missingThumb.className = "warn";
    missingThumb.textContent = "kein thumbnailUrl vorhanden";
    card.appendChild(missingThumb);
  }

  const contentUrl = safeGet(media, "contentUrl", "");
  if (contentUrl) {
    const link = document.createElement("a");
    link.href = contentUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Original öffnen";
    link.style.display = "block";
    card.appendChild(link);
  } else {
    const missingContent = document.createElement("p");
    missingContent.className = "warn";
    missingContent.textContent = "kein contentUrl vorhanden";
    card.appendChild(missingContent);
  }

  const tags = toArray(safeGet(media, "tagToQuery", []));
  const tagsEl = document.createElement("p");
  tagsEl.className = "tag-line";
  tagsEl.textContent = tags.length
    ? `tagToQuery: ${tags.join(", ")}`
    : "tagToQuery: nicht vorhanden";

  const format = fallbackText(safeGet(media, "encodingFormat", ""), "nicht vorhanden");
  const width = fallbackText(safeGet(media, "width", ""), "nicht vorhanden");
  const height = fallbackText(safeGet(media, "height", ""), "nicht vorhanden");

  const detailsEl = document.createElement("p");
  detailsEl.className = "tag-line";
  detailsEl.innerHTML = `encodingFormat: ${format} <br/> width: ${width} <br/> height: ${height}`;

  const mediaId = getMediaLookupId(media);
  if (mediaId) {
    const internalLookupLink = document.createElement("a");
    internalLookupLink.href = `index.html?id=${encodeURIComponent(mediaId)}`;
    internalLookupLink.textContent = "Medium als Objekt abfragen";
    internalLookupLink.style.display = "block";
    card.appendChild(internalLookupLink);
  } else {
    const missingId = document.createElement("p");
    missingId.className = "warn";
    missingId.textContent = "keine identifier/@id fuer Medien-Abfrage vorhanden";
    card.appendChild(missingId);
  }

  const mediaServiceUrl = getMediaServiceUrl(media);
  if (mediaServiceUrl) {
    const mediaServiceLink = document.createElement("a");
    mediaServiceLink.href = mediaServiceUrl;
    mediaServiceLink.target = "_blank";
    mediaServiceLink.rel = "noopener noreferrer";
    mediaServiceLink.textContent = "Media Service (6400x6400)";
    mediaServiceLink.style.display = "block";
    card.appendChild(mediaServiceLink);
  }

  const mediaGovernance = createMediaDataGovernanceElement(media);
  if (mediaGovernance) {
    card.appendChild(mediaGovernance);
  }

  card.appendChild(tagsEl);
  card.appendChild(detailsEl);
  return card;
}

function createMediaDataGovernanceElement(media) {
  const dataGovernance = safeGet(media, "dataGovernance", null);
  if (!dataGovernance || typeof dataGovernance !== "object") {
    return null;
  }

  const availableTabs = ["provider", "source"].filter(
    (key) => dataGovernance[key] !== null && dataGovernance[key] !== undefined
  );

  if (!availableTabs.length) {
    return null;
  }

  const wrap = document.createElement("section");
  wrap.className = "media-governance";

  const title = document.createElement("p");
  title.className = "tag-line";
  title.textContent = "Data Governance";
  wrap.appendChild(title);

  const tabBar = document.createElement("div");
  tabBar.className = "data-governance-tabs";

  const panelWrap = document.createElement("div");
  panelWrap.className = "data-governance-panels";

  const tabButtons = [];
  const tabPanels = [];

  availableTabs.forEach((tabKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "data-governance-tab";
    button.textContent = tabKey;
    button.dataset.tab = tabKey;
    tabBar.appendChild(button);
    tabButtons.push(button);

    const panel = document.createElement("section");
    panel.className = "data-governance-panel";
    panel.dataset.panel = tabKey;
    panel.appendChild(buildDataGovernanceEntityTable(dataGovernance[tabKey], dataGovernance));
    panelWrap.appendChild(panel);
    tabPanels.push(panel);

    button.addEventListener("click", () => {
      setActiveMediaGovernanceTab(tabKey);
    });
  });

  function setActiveMediaGovernanceTab(tabName) {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tabName);
    });
  }

  setActiveMediaGovernanceTab(availableTabs[0]);

  wrap.append(tabBar, panelWrap);
  return wrap;
}

function getMediaLookupId(media) {
  const identifier = String(safeGet(media, "identifier", "")).trim();
  if (identifier) {
    return identifier;
  }

  const atId = String(safeGet(media, "@id", "")).trim();
  if (!atId) {
    return "";
  }

  const withoutQuery = atId.split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function getMediaServiceUrl(media) {
  const fromThumbnail = buildMediaServiceUrlFromThumbnail(media);
  if (fromThumbnail) {
    return fromThumbnail;
  }

  const mediaId = getMediaLookupId(media);
  if (!mediaId) {
    return "";
  }

  const atId = String(safeGet(media, "@id", "")).trim().toLowerCase();
  const mediaOrigin = atId.includes("/test/")
    ? "https://media-test-v2.discover.swiss"
    : "https://media-v2.discover.swiss";

  const url = new URL(`${mediaOrigin}/image/${mediaId}`);
  url.searchParams.set("height", "6400");
  url.searchParams.set("width", "6400");
  url.searchParams.set("extension", "webp");
  return url.toString();
}

function buildMediaServiceUrlFromThumbnail(media) {
  const thumbnailUrl = String(safeGet(media, "thumbnailUrl", "")).trim();
  if (!thumbnailUrl) {
    return "";
  }

  try {
    const parsed = new URL(thumbnailUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const imageSegmentIndex = segments.findIndex((segment) => segment === "image");
    const mediaToken =
      imageSegmentIndex >= 0 ? segments[imageSegmentIndex + 1] : segments[segments.length - 1];

    if (!mediaToken) {
      return "";
    }

    const url = new URL(`${parsed.origin}/image/${mediaToken}`);
    url.searchParams.set("height", "6400");
    url.searchParams.set("width", "6400");
    url.searchParams.set("extension", "webp");
    return url.toString();
  } catch {
    return "";
  }
}

export function renderAccommodationSection(container, payload) {
  container.innerHTML = "";
  const items = toArray(safeGet(payload, "accommodation", []));
  updateAccommodationTitle(items.length);

  if (!items.length) {
    container.innerHTML = '<p class="muted">Keine Accommodation-Eintraege vorhanden.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Name</th><th>additionalType</th><th>Referenz</th><th>Aktion</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  items.forEach((item) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const name = fallbackText(item?.name, "Ohne Name");
    nameCell.textContent = name;

    const additionalTypeCell = document.createElement("td");
    additionalTypeCell.textContent = fallbackText(item?.additionalType, "-");

    const refCell = document.createElement("td");
    const ref = item?.["@id"] || item?.identifier || "keine Referenz";
    if (typeof ref === "string" && ref.startsWith("http")) {
      const refLink = document.createElement("a");
      refLink.href = ref;
      refLink.target = "_blank";
      refLink.rel = "noopener noreferrer";
      refLink.textContent = ref;
      refCell.appendChild(refLink);
    } else {
      refCell.textContent = String(ref);
    }

    const actionCell = document.createElement("td");
    const detailId = getLinkedObjectId(item);
    if (detailId) {
      const detailLink = document.createElement("a");
      detailLink.href = `index.html?id=${encodeURIComponent(detailId)}`;
      detailLink.textContent = "Detail abfrage";
      actionCell.appendChild(detailLink);
    } else {
      actionCell.textContent = "-";
    }

    row.append(nameCell, additionalTypeCell, refCell, actionCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function updateAccommodationTitle(count) {
  const panelTitle = document.querySelector('[data-panel="accommodation"] h3');
  if (panelTitle) {
    panelTitle.textContent = `Accommodation (${count})`;
  }
}

function getLinkedObjectId(item) {
  const identifier = String(safeGet(item, "identifier", "")).trim();
  if (identifier) {
    return identifier;
  }

  const atId = String(safeGet(item, "@id", "")).trim();
  if (!atId) {
    return "";
  }

  const withoutQuery = atId.split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

export function renderPotentialActionSection(container, payload) {
  container.innerHTML = "";
  const actions = toArray(safeGet(payload, "potentialAction", []));

  if (!actions.length) {
    container.innerHTML = '<p class="muted">Keine Potential Actions vorhanden.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Typ</th><th>Name</th><th>Sprache</th><th>Target Typ</th><th>Target URL</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  actions.forEach((action) => {
    const type = fallbackText(action?.additionalType, "Typ unbekannt");
    const name = fallbackText(action?.name, "-");
    const language = fallbackText(action?.inLanguage, "-");

    const targets = toArray(safeGet(action, "target", []));
    if (targets.length) {
      targets.forEach((target) => {
        const row = document.createElement("tr");
        const targetType = fallbackText(target?.type, "Typ unbekannt");
        const url = String(target?.urlTemplate || "").trim();

        const typeCell = document.createElement("td");
        typeCell.textContent = type;

        const nameCell = document.createElement("td");
        nameCell.textContent = name;

        const languageCell = document.createElement("td");
        languageCell.textContent = language;

        const targetTypeCell = document.createElement("td");
        targetTypeCell.textContent = targetType;

        const urlCell = document.createElement("td");
        if (url.startsWith("http")) {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = url;
          urlCell.appendChild(a);
        } else {
          urlCell.textContent = fallbackText(url, "URL nicht vorhanden");
        }

        row.append(typeCell, nameCell, languageCell, targetTypeCell, urlCell);
        tbody.appendChild(row);
      });
    } else {
      const row = document.createElement("tr");
      const typeCell = document.createElement("td");
      typeCell.textContent = type;
      const nameCell = document.createElement("td");
      nameCell.textContent = name;
      const languageCell = document.createElement("td");
      languageCell.textContent = language;
      const targetTypeCell = document.createElement("td");
      targetTypeCell.className = "muted";
      targetTypeCell.textContent = "-";
      const urlCell = document.createElement("td");
      urlCell.className = "muted";
      urlCell.textContent = "keine Targets vorhanden";

      row.append(typeCell, nameCell, languageCell, targetTypeCell, urlCell);
      tbody.appendChild(row);
    }
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

export function renderLinksSection(container, payload) {
  container.innerHTML = "";
  const links = toArray(safeGet(payload, "link", []));

  if (!links.length) {
    container.innerHTML = '<p class="muted">Keine Links vorhanden.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>URL</th><th>Typ</th><th>Sprache</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  links.forEach((item) => {
    const row = document.createElement("tr");
    const url = safeGet(item, "url", safeGet(item, "@id", ""));
    const type = fallbackText(item?.additionalType || item?.type, "Typ unbekannt");
    const language = fallbackText(item?.inLanguage || item?.language, "-");

    const urlCell = document.createElement("td");
    const typeCell = document.createElement("td");
    const languageCell = document.createElement("td");

    if (typeof url === "string" && url.startsWith("http")) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      urlCell.appendChild(a);
    } else {
      urlCell.textContent = fallbackText(url, "URL nicht vorhanden");
    }

    typeCell.textContent = type;
    languageCell.textContent = language;

    row.append(urlCell, typeCell, languageCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

export function renderDataGovernanceSection(container, payload) {
  container.innerHTML = "";

  const dataGovernance = safeGet(payload, "dataGovernance", null);
  if (!dataGovernance || typeof dataGovernance !== "object") {
    container.innerHTML = '<p class="muted">Keine Data-Governance-Daten vorhanden.</p>';
    return;
  }

  const availableTabs = ["origin", "provider", "source"].filter(
    (key) => dataGovernance[key] !== null && dataGovernance[key] !== undefined
  );

  if (!availableTabs.length) {
    container.innerHTML = '<p class="muted">Keine Data-Governance-Daten vorhanden.</p>';
    return;
  }

  const tabBar = document.createElement("div");
  tabBar.className = "data-governance-tabs";

  const panelWrap = document.createElement("div");
  panelWrap.className = "data-governance-panels";

  const tabButtons = [];
  const tabPanels = [];

  availableTabs.forEach((tabKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "data-governance-tab";
    button.textContent = tabKey;
    button.dataset.tab = tabKey;
    tabBar.appendChild(button);
    tabButtons.push(button);

    const panel = document.createElement("section");
    panel.className = "data-governance-panel";
    panel.dataset.panel = tabKey;
    panel.appendChild(buildDataGovernanceSubTabContent(tabKey, dataGovernance[tabKey], dataGovernance));
    panelWrap.appendChild(panel);
    tabPanels.push(panel);

    button.addEventListener("click", () => {
      setActiveDataGovernanceTab(tabKey);
    });
  });

  function setActiveDataGovernanceTab(tabName) {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tabName);
    });
  }

  setActiveDataGovernanceTab(availableTabs[0]);

  container.append(tabBar, panelWrap);
}

function buildDataGovernanceSubTabContent(tabKey, value, dataGovernance) {
  if (tabKey === "origin") {
    return buildDataGovernanceOriginContent(value, dataGovernance);
  }

  return buildDataGovernanceObjectContent(value, dataGovernance);
}

function buildDataGovernanceOriginContent(value, dataGovernance) {
  const originEntries = toArray(value);
  if (!originEntries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Keine origin-Eintraege vorhanden.";
    return empty;
  }

  const table = document.createElement("table");
  table.className = "result-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>datasource</th><th>sourceId</th><th>name</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  originEntries.forEach((entry) => {
    const row = document.createElement("tr");
    const datasourceValue = fallbackText(String(entry?.datasource || "").trim(), "-");
    const sourceIdValue = fallbackText(entry?.sourceId, "nicht vorhanden");
    const nameValue = resolveNameWithProviderFallback(entry, dataGovernance, entry?.provider)?.name;

    const datasourceCell = document.createElement("td");
    datasourceCell.textContent = datasourceValue;

    const sourceIdCell = document.createElement("td");
    sourceIdCell.textContent = sourceIdValue;

    const nameCell = document.createElement("td");
    nameCell.textContent = nameValue;

    row.append(datasourceCell, sourceIdCell, nameCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

function buildDataGovernanceObjectContent(value, dataGovernance) {
  const grid = document.createElement("dl");
  grid.className = "meta-grid";

  const dt = document.createElement("dt");
  dt.textContent = "name";
  const dd = document.createElement("dd");
  const nameResult = resolveNameWithProviderFallback(value, dataGovernance);
  dd.textContent = nameResult.name;

  grid.append(dt, dd);
  return grid;
}

function resolveNameWithProviderFallback(value, dataGovernance, entryProvider = null) {
  const primaryName = String(value?.name || "").trim();
  if (primaryName) {
    return { name: primaryName, usedFallback: false };
  }

  const entryProviderName = String(entryProvider?.name || "").trim();
  if (entryProviderName) {
    return { name: entryProviderName, usedFallback: true };
  }

  const providerName = String(dataGovernance?.provider?.name || "").trim();
  if (providerName) {
    return { name: providerName, usedFallback: true };
  }

  return { name: "nicht vorhanden", usedFallback: false };
}
