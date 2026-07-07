import type { NavLink } from "../types";
import { getLinkIconUrl } from "../lib/url";

type CompactLinkItemProps = {
  link: NavLink;
  onOpen: (link: NavLink) => void;
};

/** 快速启动用紧凑条目：仅 favicon + 标题，用于 RecentLinks 网格 */
export function CompactLinkItem({ link, onOpen }: CompactLinkItemProps) {
  return (
    <button
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100"
      onClick={() => onOpen(link)}
      type="button"
    >
      <img
        alt=""
        className="h-5 w-5 shrink-0 rounded"
        loading="lazy"
        src={getLinkIconUrl(link.url, link.iconUrl)}
        onError={(e) => {
          (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><rect width="24" height="24" rx="4"/><path d="M10 6h8v8h-2V9.4L9.4 16 8 14.6 14.6 8H10V6z" fill="%23fff"/></svg>`;
        }}
      />
      <span className="truncate text-sm font-medium text-slate-700 transition-colors hover:text-teal-600">
        {link.title}
      </span>
    </button>
  );
}
