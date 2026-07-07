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

export function getFaviconUrl(url: string) {
  try {
    const host = new URL(normalizeUrl(url)).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

export function getLinkIconUrl(url: string, iconUrl?: string) {
  return iconUrl?.trim() || getFaviconUrl(url);
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
