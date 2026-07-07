import type { NavCategory, NavLink } from "../types";
import { getUrlDedupeKey, normalizeUrl } from "./url";

const importedAt = new Date().toISOString();

function isBase64Icon(value: string) {
  return /^data:image\//i.test(value.trim());
}

function directChild(element: Element, tagName: string) {
  return Array.from(element.children).find((child) => child.tagName.toLowerCase() === tagName.toLowerCase());
}

function nextElementByTag(element: Element, tagName: string) {
  let sibling = element.nextElementSibling;
  while (sibling) {
    if (sibling.tagName.toLowerCase() === tagName.toLowerCase()) {
      return sibling;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
}

function getLinkTitle(anchor: HTMLAnchorElement) {
  return anchor.textContent?.trim() || anchor.href;
}

export function parseBookmarkHtml(html: string): NavCategory[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const root = document.querySelector("dl");
  const categoryMap = new Map<string, NavLink[]>();
  const seenUrls = new Set<string>();

  function addLink(categoryName: string, anchor: HTMLAnchorElement) {
    const href = anchor.getAttribute("href") ?? "";
    if (!href.trim()) {
      return;
    }

    const normalizedUrl = normalizeUrl(href);
    const dedupeKey = getUrlDedupeKey(normalizedUrl);
    if (seenUrls.has(dedupeKey)) {
      return;
    }
    seenUrls.add(dedupeKey);

    const icon = anchor.getAttribute("icon") ?? "";
    const links = categoryMap.get(categoryName) ?? [];
    links.push({
      id: crypto.randomUUID(),
      title: getLinkTitle(anchor),
      url: normalizedUrl,
      iconUrl: isBase64Icon(icon) ? icon : "",
      description: "",
      categoryId: "",
      clicks: 0,
      createdAt: importedAt,
      updatedAt: importedAt,
    });
    categoryMap.set(categoryName, links);
  }

  function walk(dl: Element, path: string[]) {
    Array.from(dl.children).forEach((child) => {
      if (child.tagName.toLowerCase() !== "dt") {
        return;
      }

      const anchor = directChild(child, "a") as HTMLAnchorElement | undefined;
      if (anchor) {
        addLink(path[path.length - 1] || "未分类", anchor);
        return;
      }

      const heading = directChild(child, "h3");
      if (!heading) {
        return;
      }

      const folderName = heading.textContent?.trim() || "未命名分类";
      const nextDl = directChild(child, "dl") || nextElementByTag(child, "dl");
      if (nextDl) {
        walk(nextDl, [...path, folderName]);
      }
    });
  }

  if (root) {
    walk(root, []);
  }

  return Array.from(categoryMap.entries()).map(([name, links], index) => {
    const categoryId = crypto.randomUUID();
    return {
      id: categoryId,
      name,
      sortOrder: Date.now() + index,
      links: links.map((link) => ({
        ...link,
        categoryId,
      })),
    };
  });
}
