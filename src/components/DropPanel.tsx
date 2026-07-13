import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, CircleAlert, Clipboard, Download, File, Image, Loader2, MoreHorizontal, Paperclip, Send, Settings, Trash2, X } from "lucide-react";
import { AlertDialog, Button, DropdownMenu, Flex, IconButton, Switch, Tooltip } from "@radix-ui/themes";
import {
  addDropFile,
  addDropText,
  clearDropItems,
  defaultDropSettings,
  deleteDropItem,
  downloadDropFile,
  getDropFileUrl,
  loadDropItems,
  loadDropSettings,
  saveDropSettings,
  type DropItem,
  type DropSettings,
} from "../lib/dropStore";
import { supabase } from "../lib/supabase";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; userId: string };
type SendActivity = { status: "sending" | "success" | "error"; label: string };

function formatSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isImage(item: DropItem) { return item.mimeType?.startsWith("image/") ?? false; }

function ImagePreview({ item }: { item: DropItem }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    getDropFileUrl(item).then((next) => active && setUrl(next)).catch(() => {});
    return () => { active = false; };
  }, [item]);
  return url ? <img alt={item.fileName ?? "图片"} className="max-h-52 w-full rounded-lg object-cover" src={url} /> : <div className="flex h-28 items-center justify-center rounded-lg bg-slate-100"><Loader2 className="animate-spin text-slate-400" /></div>;
}

export function DropPanel({ open, onOpenChange, userId }: Props) {
  const [items, setItems] = useState<DropItem[]>([]);
  const [settings, setSettings] = useState<DropSettings>(defaultDropSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [activity, setActivity] = useState<SendActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DropItem | "all" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dragDepth = useRef(0);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (activityTimer.current) clearTimeout(activityTimer.current);
  }, []);

  function showFinalActivity(next: SendActivity) {
    if (activityTimer.current) clearTimeout(activityTimer.current);
    setActivity(next);
    activityTimer.current = setTimeout(() => setActivity(null), next.status === "success" ? 1400 : 3000);
  }

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError("");
    Promise.all([loadDropItems(userId), loadDropSettings(userId)])
      .then(([nextItems, nextSettings]) => { setItems(nextItems); setSettings(nextSettings); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Drop 加载失败"))
      .finally(() => setLoading(false));
  }, [open, userId]);

  useEffect(() => {
    if (!open || !supabase || !userId) return;
    const client = supabase;
    const channel = client.channel(`drop:${userId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "drop_items", filter: `user_id=eq.${userId}`,
    }, () => { loadDropItems(userId).then(setItems).catch(() => {}); }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [open, userId]);

  useEffect(() => { if (open) listEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [items, open]);
  useEffect(() => {
    const panel = panelRef.current;
    if (panel) panel.inert = !open;
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [onOpenChange, open]);

  async function sendText() {
    if (!message.trim() || sending) return;
    if (activityTimer.current) clearTimeout(activityTimer.current);
    setSending(true); setError(""); setActivity({ status: "sending", label: "正在发送消息…" });
    try {
      const item = await addDropText(userId, message, settings.retentionDays);
      setItems((current) => [...current, item]);
      setMessage("");
      showFinalActivity({ status: "success", label: "消息已发送" });
    }
    catch (reason) {
      const detail = reason instanceof Error ? reason.message : "发送失败";
      setError(detail);
      showFinalActivity({ status: "error", label: "消息发送失败" });
    }
    finally { setSending(false); }
  }

  async function sendFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (!selected.length || sending) return;
    const maxFileSize = settings.maxFileSizeMb * 1024 * 1024;
    const tooLarge = selected.find((file) => file.size > maxFileSize);
    if (tooLarge) {
      setError(`${tooLarge.name} 超过 ${settings.maxFileSizeMb} MB 限制`);
      showFinalActivity({ status: "error", label: "文件超出大小限制" });
      return;
    }
    if (activityTimer.current) clearTimeout(activityTimer.current);
    setSending(true); setError("");
    setActivity({ status: "sending", label: selected.length > 1 ? `正在发送 1/${selected.length} 个文件…` : `正在发送 ${selected[0].name}…` });
    try {
      for (const [index, file] of selected.entries()) {
        if (selected.length > 1) setActivity({ status: "sending", label: `正在发送 ${index + 1}/${selected.length} 个文件…` });
        const item = await addDropFile(userId, file, settings.retentionDays);
        setItems((current) => [...current, item]);
      }
      showFinalActivity({ status: "success", label: selected.length > 1 ? `${selected.length} 个文件已发送` : "文件已发送" });
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "文件上传失败";
      setError(detail);
      showFinalActivity({ status: "error", label: "文件发送失败" });
    }
    finally { setSending(false); }
  }

  async function remove(item: DropItem) {
    try { await deleteDropItem(item); setItems((current) => current.filter((value) => value.id !== item.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); }
  }

  function requestRemove(item: DropItem) {
    if (settings.confirmBeforeDelete) setDeleteTarget(item);
    else void remove(item);
  }

  async function saveSettings(next: DropSettings) {
    setSettings(next);
    try { await saveDropSettings(userId, next); } catch (reason) { setError(reason instanceof Error ? reason.message : "设置保存失败"); }
  }

  async function clearAll() {
    try { await clearDropItems(items); setItems([]); } catch (reason) { setError(reason instanceof Error ? reason.message : "清空失败"); }
  }

  function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target === "all") void clearAll();
    else if (target) void remove(target);
  }

  return (
    <div aria-hidden={!open} className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button aria-label="关闭 Drop" className={`absolute inset-0 bg-slate-950/20 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => onOpenChange(false)} tabIndex={open ? 0 : -1} type="button" />
      <aside
        ref={panelRef}
        aria-label="Drop"
        aria-modal="true"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-[#f7f8fa] shadow-[-18px_0_60px_-28px_rgba(15,23,42,.45)] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; if (event.dataTransfer.types.includes("Files")) setDragging(true); }}
        onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
        onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); void sendFiles(event.dataTransfer.files); }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === "file")
            .flatMap((item) => item.getAsFile() ? [item.getAsFile()!] : []);
          if (files.length) { event.preventDefault(); void sendFiles(files); }
        }}
        role="dialog"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            {settingsOpen ? <IconButton aria-label="返回 Drop" color="gray" onClick={() => setSettingsOpen(false)} variant="ghost"><ChevronLeft /></IconButton> : null}
            <div><h2 className="text-lg font-semibold text-slate-950">{settingsOpen ? "Drop 设置" : "Drop"}</h2>{!settingsOpen ? <p className="text-xs text-slate-500">在你的设备之间发送文件和消息</p> : null}</div>
          </div>
          <Flex align="center" gap="3">
            {!settingsOpen ? <Tooltip content="设置"><IconButton aria-label="Drop 设置" color="gray" onClick={() => setSettingsOpen(true)} variant="ghost"><Settings size={19} /></IconButton></Tooltip> : null}
            <IconButton ref={closeButtonRef} aria-label="关闭" color="gray" onClick={() => onOpenChange(false)} variant="ghost"><X size={20} /></IconButton>
          </Flex>
        </header>

        {settingsOpen ? (
          <div className="flex-1 overflow-y-auto p-5">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4"><p className="font-medium text-slate-950">内容保留时间</p><p className="mt-1 text-xs leading-5 text-slate-500">新发送的内容到期后，会从数据库和文件存储中永久删除。</p></div>
              <div className="grid grid-cols-4 gap-2 p-4">
                {([1, 7, 30, 90] as const).map((days) => <button className={`rounded-lg border px-2 py-2 text-sm ${settings.retentionDays === days ? "border-teal-500 bg-teal-50 font-semibold text-teal-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} key={days} onClick={() => void saveSettings({ ...settings, retentionDays: days })} type="button">{days} 天</button>)}
              </div>
              <div className="border-t border-slate-100 p-4">
                <p className="text-sm font-medium text-slate-950">单个文件大小上限</p>
                <p className="mt-1 text-xs text-slate-500">拖放、选择文件和粘贴截图都使用此限制。</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([5, 10, 20] as const).map((size) => <button className={`rounded-lg border px-2 py-2 text-sm ${settings.maxFileSizeMb === size ? "border-teal-500 bg-teal-50 font-semibold text-teal-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} key={size} onClick={() => void saveSettings({ ...settings, maxFileSizeMb: size })} type="button">{size} MB</button>)}
                </div>
              </div>
              <label className="flex items-center justify-between border-t border-slate-100 p-4"><span><span className="block text-sm font-medium">紧凑显示</span><span className="text-xs text-slate-500">减小消息之间的间距</span></span><Switch checked={settings.compactMode} onCheckedChange={(value) => void saveSettings({ ...settings, compactMode: value })} /></label>
              <label className="flex items-center justify-between border-t border-slate-100 p-4"><span><span className="block text-sm font-medium">删除前确认</span><span className="text-xs text-slate-500">避免误删文件和消息</span></span><Switch checked={settings.confirmBeforeDelete} onCheckedChange={(value) => void saveSettings({ ...settings, confirmBeforeDelete: value })} /></label>
            </section>
            <Button className="mt-5 w-full" color="red" disabled={!items.length} onClick={() => setDeleteTarget("all")} variant="soft"><Trash2 size={16} />清空全部内容</Button>
          </div>
        ) : (
          <>
            <div className={`scrollbar-subtle relative flex-1 overflow-y-auto px-4 ${settings.compactMode ? "py-2" : "py-4"}`}>
              {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div> : items.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-8 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><Send size={28} /></div><p className="font-semibold text-slate-900">把内容发送给自己</p><p className="mt-2 text-sm leading-6 text-slate-500">拖放文件到这里，或在下方输入消息。登录同一账号的设备都能看到。</p></div> : <div className={settings.compactMode ? "space-y-2" : "space-y-4"}>{items.map((item) => <article className="group ml-auto max-w-[94%]" key={item.id}>
                <Flex align="center" gap="1" justify="end">
                  <DropdownMenu.Root modal={false}>
                    <DropdownMenu.Trigger><IconButton aria-label="更多操作" className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100" color="gray" size="1" variant="ghost"><MoreHorizontal size={15} /></IconButton></DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">{item.kind === "text" ? <DropdownMenu.Item onSelect={() => { void navigator.clipboard.writeText(item.content); setCopiedId(item.id); setTimeout(() => setCopiedId(""), 1500); }}>{copiedId === item.id ? <Check size={15} /> : <Clipboard size={15} />}复制</DropdownMenu.Item> : <DropdownMenu.Item onSelect={() => void downloadDropFile(item)}><Download size={15} />下载</DropdownMenu.Item>}<DropdownMenu.Item color="red" onSelect={() => requestRemove(item)}><Trash2 size={15} />删除</DropdownMenu.Item></DropdownMenu.Content>
                  </DropdownMenu.Root>
                  <div className="min-w-0 max-w-[calc(100%_-_30px)] rounded-2xl rounded-br-md border border-slate-200 bg-white p-3 shadow-sm">
                    {item.kind === "text" ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.content}</p> : isImage(item) ? <><ImagePreview item={item} /><div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Image size={14} /><span className="min-w-0 flex-1 truncate">{item.fileName}</span><span>{formatSize(item.fileSize)}</span></div></> : <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><File size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.fileName}</span><span className="text-xs text-slate-500">{formatSize(item.fileSize)}</span></span><IconButton aria-label="下载" color="gray" onClick={() => void downloadDropFile(item)} variant="ghost"><Download size={17} /></IconButton></div>}
                  </div>
                </Flex>
                <div className="mt-1 flex items-center justify-end gap-1 px-1 text-[11px] text-slate-400"><span>{formatTime(item.createdAt)}</span><span>· 保留至 {new Date(item.expiresAt).toLocaleDateString("zh-CN")}</span></div>
              </article>)}</div>}
              {dragging ? <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-teal-500 bg-teal-50/95 text-sm font-semibold text-teal-700">释放以上传并发送</div> : null}
              <div ref={listEnd} />
            </div>
            {error ? <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div> : null}
            <footer className="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
              {activity ? (
                <div aria-live="polite" className={`mb-2 flex items-center gap-2 px-2 text-xs font-medium ${activity.status === "error" ? "text-red-600" : activity.status === "success" ? "text-teal-700" : "text-slate-500"}`}>
                  {activity.status === "sending" ? <Loader2 className="animate-spin" size={15} /> : activity.status === "success" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                  <span className="min-w-0 truncate">{activity.label}</span>
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <input ref={fileInput} className="hidden" multiple onChange={(e) => { if (e.target.files) void sendFiles(e.target.files); e.target.value = ""; }} type="file" />
                <Tooltip content={`添加文件（最大 ${settings.maxFileSizeMb} MB）`}><IconButton aria-label="添加文件" className="h-9 w-9 shrink-0 self-end" color="gray" disabled={sending} onClick={() => fileInput.current?.click()} variant="ghost"><Paperclip size={18} /></IconButton></Tooltip>
                <textarea aria-label="给自己发送消息" className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm outline-none" onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } }} placeholder="给自己发送消息" rows={1} value={message} />
                <IconButton aria-label="发送" className="h-9 w-9 shrink-0 self-end" disabled={sending || !message.trim()} onClick={() => void sendText()} variant="solid">{sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</IconButton>
              </div>
            </footer>
          </>
        )}
        <AlertDialog.Root open={deleteTarget !== null} onOpenChange={(nextOpen) => { if (!nextOpen) setDeleteTarget(null); }}>
          <AlertDialog.Content maxWidth="420px">
            <AlertDialog.Title>{deleteTarget === "all" ? "清空全部内容？" : "删除这条内容？"}</AlertDialog.Title>
            <AlertDialog.Description size="2">
              {deleteTarget === "all" ? "Drop 中的全部消息和文件都会被永久删除，此操作无法撤销。" : "这条内容及其关联文件会被永久删除，此操作无法撤销。"}
            </AlertDialog.Description>
            <Flex className="mt-5" gap="2" justify="end">
              <AlertDialog.Cancel><Button color="gray" variant="soft">取消</Button></AlertDialog.Cancel>
              <AlertDialog.Action><Button color="red" onClick={confirmDelete}>永久删除</Button></AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </aside>
    </div>
  );
}
