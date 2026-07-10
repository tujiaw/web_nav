import type { NavCategory } from "../types";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function navigationToBookmarkHtml(categories: NavCategory[]) {
  const folders = categories.map((category) => {
    const links = category.links.map((link) =>
      `        <DT><A HREF="${escapeHtml(link.url)}">${escapeHtml(link.title)}</A>`,
    ).join("\n");
    return `    <DT><H3>${escapeHtml(category.name)}</H3>\n    <DL><p>\n${links}\n    </DL><p>`;
  }).join("\n");
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Web Nav Bookmarks</TITLE>\n<H1>Web Nav Bookmarks</H1>\n<DL><p>\n${folders}\n</DL><p>\n`;
}

export function downloadNavigation(categories: NavCategory[], format: "html" | "json") {
  const content = format === "json"
    ? JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, categories }, null, 2)
    : navigationToBookmarkHtml(categories);
  const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `web-nav-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
