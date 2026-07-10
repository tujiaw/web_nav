export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export const DEFAULT_LINK_ICON_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#e2e8f0"/><path d="M10 6h8v8h-2V9.4L9.4 16 8 14.6 14.6 8H10V6z" fill="#475569"/></svg>',
)}`;

export function setDefaultLinkIcon(image: HTMLImageElement) {
  if (image.src !== DEFAULT_LINK_ICON_URL) {
    image.src = DEFAULT_LINK_ICON_URL;
  }
}

export function getFaviconUrl(url: string) {
  try {
    const host = new URL(normalizeUrl(url)).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return DEFAULT_LINK_ICON_URL;
  }
}

export function getLinkIconUrl(url: string, iconUrl?: string) {
  return iconUrl?.trim() || getFaviconUrl(url) || DEFAULT_LINK_ICON_URL;
}

export function getHostname(url: string) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getUrlDedupeKey(url: string) {
  try {
    const parsed = new URL(normalizeUrl(url));
    parsed.hash = "";

    const pathname =
      parsed.pathname !== "/" && parsed.pathname.endsWith("/")
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname === "/"
          ? ""
          : parsed.pathname;

    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ""}${pathname}${parsed.search}`;
  } catch {
    return normalizeUrl(url).replace(/\/$/, "").toLowerCase();
  }
}
