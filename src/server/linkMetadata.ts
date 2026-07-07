export type LinkMetadata = {
  title: string;
  iconUrl: string;
  url: string;
};

const iconRelPriority = [
  "apple-touch-icon-precomposed",
  "apple-touch-icon",
  "icon",
  "shortcut icon",
  "fluid-icon",
  "mask-icon",
];

function normalizeInputUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请输入链接地址");
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i")) ?? tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return match?.[2] ?? match?.[1] ?? "";
}

function getTitle(head: string, html: string) {
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(title.replace(/\s+/g, " ")) : "";
}

function scoreIcon(tag: string) {
  const rel = getAttribute(tag, "rel").toLowerCase();
  const sizes = getAttribute(tag, "sizes").toLowerCase();
  const priority = iconRelPriority.findIndex((item) => rel.split(/\s+/).join(" ").includes(item));
  const sizeScore = sizes.includes("192") || sizes.includes("180") ? 2 : sizes.includes("32") || sizes.includes("64") ? 1 : 0;

  return (priority === -1 ? 0 : iconRelPriority.length - priority) * 10 + sizeScore;
}

function getIconUrl(head: string, pageUrl: string) {
  const links = [...head.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => {
      const rel = getAttribute(tag, "rel").toLowerCase();
      return rel.includes("icon") || rel.includes("fluid-icon") || rel.includes("mask-icon");
    })
    .map((tag) => ({ href: getAttribute(tag, "href"), score: scoreIcon(tag) }))
    .filter((item) => item.href && item.href.trim().toLowerCase() !== "data:,")
    .sort((a, b) => b.score - a.score);

  const href = links[0]?.href || "/favicon.ico";
  return new URL(decodeHtml(href), pageUrl).toString();
}

async function fetchIconAsDataUrl(iconUrl: string) {
  if (iconUrl.startsWith("data:image/")) {
    return iconUrl;
  }

  try {
    const response = await fetch(iconUrl, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; WebNavMetadataBot/1.0)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return "";
    }

    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/x-icon";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function fetchLinkMetadata(inputUrl: string): Promise<LinkMetadata> {
  const url = normalizeInputUrl(inputUrl);
  const parsed = new URL(url);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("仅支持 HTTP 或 HTTPS 链接");
  }

  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (compatible; WebNavMetadataBot/1.0)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`链接检查失败：${response.status}`);
  }

  const html = await response.text();
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html.slice(0, 20000);

  const iconUrl = getIconUrl(head, response.url || url);

  return {
    title: getTitle(head, html) || parsed.hostname.replace(/^www\./, ""),
    iconUrl: await fetchIconAsDataUrl(iconUrl),
    url: response.url || url,
  };
}
