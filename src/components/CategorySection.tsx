import type { NavCategory, NavLink } from "../types";
import { LinkRow } from "./LinkRow";

type CategorySectionProps = {
  category: NavCategory;
  isLoading?: boolean;
  onAddLink: (categoryId: string) => void;
  onOpenLink: (link: NavLink) => void;
  onEditLink: (link: NavLink) => void;
  onDeleteLink: (link: NavLink) => void;
  userId?: string;
};

/** 分类区块：只渲染当前 Tab 下的链接列表 */
export function CategorySection({
  category,
  isLoading = false,
  onAddLink,
  onDeleteLink,
  onEditLink,
  onOpenLink,
  userId,
}: CategorySectionProps) {
  return (
    <section>
      {/* 链接网格：响应式多列 */}
      {isLoading ? (
        <p className="px-3 py-4 text-center text-sm text-slate-400">正在加载链接...</p>
      ) : category.links.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {category.links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              onDelete={onDeleteLink}
              onEdit={onEditLink}
              onOpen={onOpenLink}
              userId={userId}
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-4 text-center text-sm text-slate-400">
          暂无链接，
          <button
            className="text-teal-600 hover:underline"
            onClick={() => onAddLink(category.id)}
            type="button"
          >
            添加第一个
          </button>
        </p>
      )}
    </section>
  );
}
