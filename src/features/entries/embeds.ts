/** Turning user-supplied URLs into safe embed URLs. Pure. Unknown hosts are never embedded. */

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export function isHttpUrl(url: string): boolean {
  return parse(url) !== null;
}

const YT_ID = /^[\w-]{11}$/;

/** YouTube / Vimeo page URLs → embeddable player URLs. */
export function videoEmbedUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return YT_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = u.searchParams.get("v");
    const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/);
    if (m) id = m[2];
    return id && YT_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{6,12})(?:\/([\da-f]+))?/);
    if (!m) return null;
    const hash = m[2] ?? u.searchParams.get("h");
    return `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}`;
  }
  return null;
}

/** Providers allowed in EMBED entries and presentation URLs. */
const EMBED_RULES: { label: string; match: (u: URL) => string | null }[] = [
  { label: "YouTube / Vimeo", match: (u) => videoEmbedUrl(u.href) },
  {
    label: "Google Docs, Slides, Sheets, Forms",
    match: (u) => {
      if (u.hostname !== "docs.google.com") return null;
      const m = u.pathname.match(/^\/(presentation|document|spreadsheets|forms)\/d\/(e\/)?([\w-]+)/);
      if (!m) return null;
      const [, kind, published, id] = m;
      const base = `https://docs.google.com/${kind}/d/${published ?? ""}${id}`;
      if (kind === "presentation") return `${base}/embed`;
      if (kind === "forms") return `${base}/viewform?embedded=true`;
      return `${base}/preview`;
    },
  },
  {
    label: "Google Drive files",
    match: (u) => {
      const m = u.hostname === "drive.google.com" && u.pathname.match(/^\/file\/d\/([\w-]+)/);
      return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
    },
  },
  { label: "H5P", match: (u) => (/(^|\.)h5p\.com$/.test(u.hostname) && u.protocol === "https:" ? u.href : null) },
  { label: "Genially", match: (u) => (u.hostname === "view.genially.com" || u.hostname === "view.genial.ly" ? u.href : null) },
  {
    label: "Figma",
    match: (u) =>
      u.hostname === "www.figma.com" && /^\/(file|design|proto|board)\//.test(u.pathname)
        ? `https://www.figma.com/embed?embed_host=course-platform&url=${encodeURIComponent(u.href)}`
        : u.hostname === "www.figma.com" && u.pathname === "/embed"
          ? u.href
          : null,
  },
  {
    label: "Canva",
    match: (u) => {
      const m = u.hostname === "www.canva.com" && u.pathname.match(/^\/design\/([\w-]+)\/([\w-]+)\//);
      return m ? `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed` : null;
    },
  },
];

export const EMBED_PROVIDERS = EMBED_RULES.map((r) => r.label);

/** A safe iframe URL for a supported provider, or null. */
export function toEmbedUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  for (const rule of EMBED_RULES) {
    const embed = rule.match(u);
    if (embed) return embed;
  }
  return null;
}
