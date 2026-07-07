import type { NavLink } from "../types";
import { CompactLinkItem } from "./CompactLinkItem";

type RecentLinksProps = {
  links: NavLink[];
  onOpen: (link: NavLink) => void;
};

/** 快速启动区：紧凑网格，仅 favicon + 标题，按点击频率排序 */
export function RecentLinks({ links, onOpen }: RecentLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-slate-50/70 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500">快速启动</h2>
        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-400">
          {links.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {links.slice(0, 12).map((link) => (
          <CompactLinkItem key={link.id} link={link} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
