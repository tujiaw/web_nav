import type { NavLink } from "../types";
import { LinkIcon } from "./LinkIcon";

type CompactLinkItemProps = {
  link: NavLink;
  onOpen: (link: NavLink) => void;
  userId?: string;
};

/** 快速启动用紧凑条目：仅 favicon + 标题，用于 RecentLinks 网格 */
export function CompactLinkItem({ link, onOpen, userId }: CompactLinkItemProps) {
  return (
    <button
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100"
      onClick={() => onOpen(link)}
      type="button"
    >
      <LinkIcon
        className="h-5 w-5 shrink-0 rounded"
        link={link}
        userId={userId}
      />
      <span className="truncate text-sm font-medium text-slate-700 transition-colors hover:text-teal-600">
        {link.title}
      </span>
    </button>
  );
}
