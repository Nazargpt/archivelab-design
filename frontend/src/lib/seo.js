// Lightweight per-page SEO: updates title, meta description, Open Graph / Twitter tags
// and an optional JSON-LD block. (SPA — crawlers that don't run JS fall back to index.html defaults.)

const SITE = "https://archivelab.design";

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function setSeo({ title, description, image, path = "", jsonld } = {}) {
  const full = title ? `${title} · ARCHIVE LAB` : "ARCHIVE LAB · Piezas de autor — Cami Guerra";
  document.title = full;
  const url = SITE + path;
  const img = image || `${SITE}/brand/img1.jpeg`;
  setMeta("name", "description", description);
  setMeta("property", "og:title", full);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:image", img);
  setMeta("name", "twitter:title", full);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", img);

  let ld = document.getElementById("page-jsonld");
  if (jsonld) {
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = "page-jsonld";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify(jsonld);
  } else if (ld) {
    ld.remove();
  }
}
