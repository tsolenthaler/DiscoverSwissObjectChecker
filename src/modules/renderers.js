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
  const { endpoint, id, requestUrl, source } = context;
  const rows = [
    ["Endpoint", endpoint],
    ["Objekt-ID", id],
    ["Erkannt via", source],
    ["Request URL", requestUrl]
  ];

  container.innerHTML = "";

  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");

    if (term === "Request URL") {
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

export function renderMediaSection(container, payload) {
  container.innerHTML = "";

  const primary = safeGet(payload, "image", null);
  const gallery = toArray(safeGet(payload, "photo", []));

  const primaryWrap = document.createElement("section");
  primaryWrap.className = "block";
  const primaryTitle = document.createElement("h4");
  primaryTitle.textContent = "Hauptbild (image)";
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

  card.appendChild(tagsEl);
  card.appendChild(detailsEl);
  return card;
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
    return url.toString();
  } catch {
    return "";
  }
}

export function renderAccommodationSection(container, payload) {
  container.innerHTML = "";
  const items = toArray(safeGet(payload, "accommodation", []));

  if (!items.length) {
    container.innerHTML = '<p class="muted">Keine Accommodation-Eintraege vorhanden.</p>';
    return;
  }

  const list = document.createElement("ul");
  list.className = "list";

  items.forEach((item) => {
    const li = document.createElement("li");
    const name = fallbackText(item?.name, "Ohne Name");
    const ref = item?.["@id"] || item?.identifier || "keine Referenz";

    if (typeof ref === "string" && ref.startsWith("http")) {
      const link = document.createElement("a");
      link.href = ref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${name} (${ref})`;
      li.appendChild(link);
    } else {
      li.textContent = `${name} (${ref})`;
    }

    list.appendChild(li);
  });

  container.appendChild(list);
}

export function renderLinksSection(container, payload) {
  container.innerHTML = "";
  const links = toArray(safeGet(payload, "link", []));

  if (!links.length) {
    container.innerHTML = '<p class="muted">Keine Links vorhanden.</p>';
    return;
  }

  const list = document.createElement("ul");
  list.className = "list";

  links.forEach((item) => {
    const li = document.createElement("li");
    const url = safeGet(item, "url", safeGet(item, "@id", ""));
    const type = fallbackText(item?.additionalType || item?.type, "Typ unbekannt");
    const language = fallbackText(item?.inLanguage || item?.language, "Sprache unbekannt");

    if (typeof url === "string" && url.startsWith("http")) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      li.appendChild(a);
    } else {
      li.textContent = fallbackText(url, "URL nicht vorhanden");
    }

    const meta = document.createElement("span");
    meta.className = "muted";
    meta.textContent = ` | Typ: ${type} | Sprache: ${language}`;
    li.appendChild(meta);

    list.appendChild(li);
  });

  container.appendChild(list);
}
