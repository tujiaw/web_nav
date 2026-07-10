import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { IconButton, Tooltip } from "@radix-ui/themes";
import type { NavLink } from "../types";
import { useEditMode } from "./EditModeContext";
import { LinkIcon } from "./LinkIcon";

type LinkRowProps = {
  link: NavLink;
  onOpen: (link: NavLink) => void;
  onEdit?: (link: NavLink) => void;
  onDelete?: (link: NavLink) => void;
  userId?: string;
};

/** 三行式链接条目：favicon + 标题 / URL / 描述，hover 显示操作按钮，适配网格布局 */
export function LinkRow({ link, onOpen, onEdit, onDelete, userId }: LinkRowProps) {
  const displayUrl = link.url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const { editMode } = useEditMode();

  return (
    <div className="group flex min-w-0 items-start gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50/60 hover:shadow-sm">
      {/* favicon */}
      <LinkIcon
        className="mt-0.5 h-5 w-5 shrink-0 rounded"
        link={link}
        userId={userId}
      />

      {/* 文字区域 */}
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(link)}
        type="button"
      >
        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
          {link.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-400">
          {displayUrl}
        </span>
        {link.description ? (
          <span className="mt-0.5 block truncate text-xs text-slate-300">
            {link.description}
          </span>
        ) : null}
      </button>

      {/* hover 操作按钮 */}
      {editMode ? (
        <div className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <Tooltip content="新标签页打开">
            <IconButton
              aria-label="新标签页打开"
              color="gray"
              onClick={() => onOpen(link)}
              size="1"
              variant="ghost"
            >
              <ExternalLink size={14} />
            </IconButton>
          </Tooltip>
          {onEdit ? (
            <Tooltip content="编辑链接">
              <IconButton
                aria-label="编辑链接"
                color="gray"
                onClick={() => onEdit(link)}
                size="1"
                variant="ghost"
              >
                <Pencil size={14} />
              </IconButton>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip content="删除链接">
              <IconButton
                aria-label="删除链接"
                color="gray"
                onClick={() => onDelete(link)}
                size="1"
                variant="ghost"
              >
                <Trash2 size={14} />
              </IconButton>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
