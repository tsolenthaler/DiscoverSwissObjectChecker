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
    link.textContent = "Original oeffnen";
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

  card.appendChild(tagsEl);
  return card;
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
