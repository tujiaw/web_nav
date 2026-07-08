import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FolderPlus,
  Github,
  LayoutDashboard,
  Loader2,
  LogOut,
  Pencil,
  Upload,
  Plus,
  ShieldCheck,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import { AlertDialog, Button, Callout, Dialog, DropdownMenu, IconButton, Switch, Tabs, Theme, Tooltip } from "@radix-ui/themes";
import { CategorySection } from "./components/CategorySection";
import { EmptyState } from "./components/EmptyState";
import { CategoryForm, LinkForm, ProfileForm } from "./components/Forms";
import { RecentLinks } from "./components/RecentLinks";
import { SearchPanel } from "./components/SearchPanel";
import { defaultCategories } from "./data/defaults";
import { useAuth } from "./hooks/useAuth";
import {
  createDefaultNavigation,
  deleteCategory,
  deleteLink,
  getProfile,
  importNavigation,
  incrementClicks,
  loadNavigation,
  saveCategory,
  saveCategoryOrder,
  saveLink,
  upsertProfile,
} from "./lib/navStore";
import { isSupabaseConfigured } from "./lib/supabase";
import { parseBookmarkHtml } from "./lib/bookmarkImport";
import { normalizeUrl } from "./lib/url";
import { EditModeProvider, useEditMode } from "./components/EditModeContext";
import type { CategoryFormValue, LinkFormValue, NavCategory, NavLink, Profile } from "./types";

type DialogState =
  | { type: "link"; link?: NavLink; categoryId?: string }
  | { type: "category"; category?: NavCategory }
  | { type: "profile" }
  | null;

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<Array<{ getFile: () => Promise<File> }>>;
};

const BING_WALLPAPER_STORAGE_KEY = "web-nav-bing-wallpaper";

function getDisplayName(userName?: string | null, email?: string | null) {
  return userName || email?.split("@")[0] || "我的导航";
}

function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      await onLogin();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between bg-slate-950 p-8 text-white sm:p-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-500">
                <LayoutDashboard size={20} />
              </span>
              <div>
                <h1 className="text-xl font-bold">Web Nav</h1>
                <p className="text-xs text-slate-400">personal navigation workspace</p>
              </div>
            </div>
            <div className="mt-14 max-w-sm">
              <p className="text-3xl font-bold leading-tight">把工作入口、AI 搜索和个人收藏放进一个稳定工作台。</p>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                登录后每个人都有独立配置，分类、常用链接、搜索引擎和收藏夹导入都会同步到自己的空间。
              </p>
            </div>
          </div>
          <div className="mt-12 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-teal-300" />
              GitHub 鉴权，Supabase 按用户隔离数据
            </div>
            <div className="flex items-center gap-2">
              <LayoutDashboard size={16} className="text-teal-300" />
              适合长期维护大量分类与导航入口
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-7">
              <p className="text-sm font-semibold text-teal-700">登录工作台</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">进入你的个人网址导航</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">使用 GitHub 登录后，配置会自动关联到当前账号。</p>
            </div>
            {isSupabaseConfigured ? (
              <Button className="h-11 w-full bg-slate-950 font-semibold text-white hover:bg-slate-800" disabled={loading} onClick={handleLogin} size="3">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Github size={18} />}
                {loading ? "正在跳转..." : "使用 GitHub 登录"}
              </Button>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                请先配置 <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code>，再启用 GitHub 登录。
              </div>
            )}
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function AppContent() {
  const { loading: authLoading, signInWithGitHub, signOut, user } = useAuth();
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<NavLink | NavCategory | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bookmarkFile, setBookmarkFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [draggingCategoryId, setDraggingCategoryId] = useState("");
  const [bingWallpaperEnabled, setBingWallpaperEnabled] = useState(() => localStorage.getItem(BING_WALLPAPER_STORAGE_KEY) === "true");
  const [bingWallpaperUrl, setBingWallpaperUrl] = useState("");
  const bookmarkInputRef = useRef<HTMLInputElement | null>(null);
  const { editMode, toggleEditMode } = useEditMode();

  const userId = user?.id ?? "";
  const fallbackName = getDisplayName(user?.user_metadata?.user_name as string | undefined, user?.email);
  const allLinks = useMemo(() => categories.flatMap((category) => category.links), [categories]);
  const recentLinks = useMemo(
    () =>
      [...allLinks]
        .filter((link) => link.clicks > 0)
        .sort((a, b) => b.clicks - a.clicks || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 12),
    [allLinks],
  );

  const filteredCategories = categories;
  const pageBackgroundStyle = bingWallpaperEnabled && bingWallpaperUrl
    ? {
        backgroundImage: `url(${bingWallpaperUrl})`,
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;

  const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (!userId) {
      return;
    }

    const showLoading = options.showLoading ?? true;
    setError("");
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [nextProfile, nextCategories] = await Promise.all([getProfile(userId), loadNavigation(userId)]);

      if (nextCategories.length === 0) {
        await createDefaultNavigation(userId, defaultCategories);
        setCategories(await loadNavigation(userId));
      } else {
        setCategories(nextCategories);
      }

      if (nextProfile) {
        setProfile(nextProfile);
      } else {
        setProfile(await upsertProfile(userId, fallbackName, ""));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载失败");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [fallbackName, userId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!userId) {
      setLoading(false);
      return;
    }

    refresh();
  }, [authLoading, refresh, userId]);

  useEffect(() => {
    localStorage.setItem(BING_WALLPAPER_STORAGE_KEY, String(bingWallpaperEnabled));
  }, [bingWallpaperEnabled]);

  useEffect(() => {
    if (!bingWallpaperEnabled || bingWallpaperUrl) {
      return;
    }

    let ignore = false;
    async function loadBingWallpaper() {
      try {
        const response = await fetch("/api/bing-wallpaper");
        if (!response.ok) {
          throw new Error("Bing wallpaper fetch failed");
        }
        const payload = await response.json() as { url?: string };
        if (!ignore && payload.url) {
          setBingWallpaperUrl(payload.url);
        }
      } catch {
        if (!ignore) {
          setBingWallpaperEnabled(false);
        }
      }
    }

    void loadBingWallpaper();
    return () => {
      ignore = true;
    };
  }, [bingWallpaperEnabled, bingWallpaperUrl]);

  // 自动选中第一个分类
  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategoryId("");
      return;
    }
    if (!categories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [activeCategoryId, categories]);

  async function handleOpenLink(link: NavLink) {
    window.open(normalizeUrl(link.url), "_blank", "noopener,noreferrer");
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        links: category.links.map((item) =>
          item.id === link.id ? { ...item, clicks: item.clicks + 1, updatedAt: new Date().toISOString() } : item,
        ),
      })),
    );

    try {
      await incrementClicks(link);
    } catch {
      await refresh();
    }
  }

  async function handleSaveLink(value: LinkFormValue) {
    if (!user) {
      return;
    }

    await saveLink(user.id, value);
    setDialog(null);
    await refresh({ showLoading: false });
  }

  async function handleSaveCategory(value: CategoryFormValue) {
    if (!user) {
      return;
    }

    await saveCategory(user.id, value);
    setDialog(null);
    await refresh({ showLoading: false });
  }

  async function handleReorderCategory(targetCategoryId: string) {
    if (!user || !draggingCategoryId || draggingCategoryId === targetCategoryId) {
      setDraggingCategoryId("");
      return;
    }

    const sourceIndex = categories.findIndex((category) => category.id === draggingCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingCategoryId("");
      return;
    }

    const nextCategories = [...categories];
    const [movedCategory] = nextCategories.splice(sourceIndex, 1);
    nextCategories.splice(targetIndex, 0, movedCategory);
    const orderedCategories = nextCategories.map((category, index) => ({
      ...category,
      sortOrder: Date.now() + index,
    }));

    setDraggingCategoryId("");
    setCategories(orderedCategories);

    try {
      await saveCategoryOrder(user.id, orderedCategories);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "调整分类顺序失败");
      await refresh({ showLoading: false });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      if ("links" in deleteTarget) {
        await deleteCategory(deleteTarget.id);
      } else {
        await deleteLink(deleteTarget.id);
      }

      setDeleteTarget(null);
      await refresh({ showLoading: false });
    } catch (reason) {
      setDeleteTarget(null);
      setError(reason instanceof Error ? reason.message : "删除失败");
    }
  }

  async function handleSaveProfile(username: string, passwordHint: string) {
    if (!user) {
      return;
    }

    setProfile(await upsertProfile(user.id, username, passwordHint));
    setDialog(null);
  }

  async function handleChooseBookmarkFile() {
    const pickerWindow = window as FilePickerWindow;
    if (!pickerWindow.showOpenFilePicker) {
      bookmarkInputRef.current?.click();
      return;
    }

    try {
      const [fileHandle] = await pickerWindow.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "浏览器收藏夹 HTML",
            accept: {
              "text/html": [".html", ".htm"],
            },
          },
        ],
      });
      setBookmarkFile(await fileHandle.getFile());
      setImportResult("");
      setError("");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        return;
      }
      setError(reason instanceof Error ? reason.message : "选择文件失败");
    }
  }

  function handleBookmarkFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setBookmarkFile(file);
      setImportResult("");
      setError("");
    }
    event.target.value = "";
  }

  async function handleImportBookmarks() {
    if (!userId) {
      return;
    }
    if (!bookmarkFile) {
      setError("请先选择收藏夹 HTML 文件");
      return;
    }

    setImporting(true);
    setError("");
    setImportResult("");
    try {
      const parsedCategories = parseBookmarkHtml(await bookmarkFile.text());
      const result = await importNavigation(userId, parsedCategories);
      setImportResult(`已导入 ${result.links} 个链接、${result.categories} 个分类，跳过 ${result.skipped} 个重复链接。`);
      setBookmarkFile(null);
      await refresh({ showLoading: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-slate-500">
        <div className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.65)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white">
            <Loader2 className="animate-spin" size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">正在加载工作台</p>
            <p className="text-xs text-slate-500">同步你的分类和导航</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={signInWithGitHub} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" style={pageBackgroundStyle}>
      {/* ── 顶部导航条（sticky） ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white shadow-[0_10px_24px_-16px_rgba(20,184,166,0.9)]">
              <LayoutDashboard size={17} />
            </span>
            <span className="hidden text-base font-bold text-slate-950 sm:inline">Web Nav</span>
          </div>

          {/* 搜索栏 */}
          <div className="flex flex-1 justify-center">
            <SearchPanel links={allLinks} onOpenLink={handleOpenLink} />
          </div>

          {/* 右侧操作 */}
          <div className="flex shrink-0 items-center gap-2">
            {/* 编辑模式切换 */}
            <Tooltip content={editMode ? "切换到浏览模式" : "切换到编辑模式"}>
              <IconButton
                aria-label={editMode ? "切换到浏览模式" : "切换到编辑模式"}
                color="gray"
                onClick={toggleEditMode}
                variant={editMode ? "solid" : "ghost"}
              >
                {editMode ? <Eye size={17} /> : <Pencil size={17} />}
              </IconButton>
            </Tooltip>

            {/* 用户下拉菜单 */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton aria-label="用户菜单" color="gray" className="rounded-full border border-slate-200 bg-white/70" variant="soft">
                  <UserRound size={17} />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="min-w-[180px]">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{profile?.username ?? fallbackName}</p>
                  <p className="truncate text-xs text-slate-400">{user.email}</p>
                </div>
                {editMode ? (
                  <>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onSelect={() => setDialog({ type: "link" })}>
                      <Plus size={15} />
                      新增链接
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setDialog({ type: "category" })}>
                      <FolderPlus size={15} />
                      新增分类
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setImportDialogOpen(true)}>
                      <Upload size={15} />
                      导入收藏夹
                    </DropdownMenu.Item>
                  </>
                ) : null}
                <DropdownMenu.Separator />
                <div className="flex items-center justify-between gap-4 px-3 py-2 text-sm text-slate-700">
                  <span>必应背景壁纸</span>
                  <Switch
                    checked={bingWallpaperEnabled}
                    onCheckedChange={setBingWallpaperEnabled}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={() => setDialog({ type: "profile" })}>
                  <Settings size={15} />
                  账号设置
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item color="red" onSelect={signOut}>
                  <LogOut size={15} />
                  退出登录
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>

      {/* ── 主内容区 ── */}
      <main className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}

          {/* 快速启动（仅在未搜索时显示） */}
          <RecentLinks links={recentLinks} onOpen={handleOpenLink} />

          {/* 分类标签 */}
          {filteredCategories.length > 0 ? (
            <Tabs.Root
              className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.9)]"
              onValueChange={setActiveCategoryId}
              value={activeCategoryId}
            >
              <div className="border-b border-slate-200/80 pb-3">
                <Tabs.List className="flex flex-wrap gap-1 bg-transparent">
                  {filteredCategories.map((category) => (
                    <div
                      className={`flex max-w-full items-center gap-0.5 rounded-md ${
                        editMode ? "cursor-grab active:cursor-grabbing" : ""
                      } ${draggingCategoryId === category.id ? "opacity-45" : ""}`}
                      draggable={editMode}
                      key={category.id}
                      onDragEnd={() => setDraggingCategoryId("")}
                      onDragOver={(event) => {
                        if (editMode && draggingCategoryId && draggingCategoryId !== category.id) {
                          event.preventDefault();
                        }
                      }}
                      onDragStart={(event) => {
                        if (!editMode) {
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", category.id);
                        setDraggingCategoryId(category.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void handleReorderCategory(category.id);
                      }}
                    >
                      <Tabs.Trigger
                        className={`min-w-0 max-w-[180px] shrink-0 border px-3 ${
                          category.id === activeCategoryId
                            ? "border-slate-950 bg-slate-950 font-semibold text-white shadow-sm"
                            : "border-transparent"
                        }`}
                        value={category.id}
                      >
                        <span className="min-w-0 max-w-[128px] truncate">{category.name}</span>
                        <span className="ml-1 text-xs opacity-70">{category.links.length}</span>
                      </Tabs.Trigger>
                      {editMode && category.id === activeCategoryId ? (
                        <>
                          <Tooltip content="修改 Tab 名">
                            <IconButton
                              aria-label={`修改 ${category.name} Tab 名`}
                              className="relative z-10 shrink-0"
                              color="gray"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDialog({ type: "category", category });
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              size="1"
                              variant="ghost"
                            >
                              <Pencil size={13} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip content="删除分类">
                            <IconButton
                              aria-label={`删除 ${category.name} 分类`}
                              className="relative z-10 shrink-0"
                              color="red"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(category);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              size="1"
                              variant="ghost"
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : null}
                    </div>
                  ))}
                </Tabs.List>
              </div>
              {filteredCategories.map((category) => (
                <Tabs.Content className="pt-4" key={category.id} value={category.id}>
                  <CategorySection
                    category={category}
                    onAddLink={(categoryId) => setDialog({ type: "link", categoryId })}
                    onDeleteLink={setDeleteTarget}
                    onEditLink={(link) => setDialog({ type: "link", link })}
                    onOpenLink={handleOpenLink}
                  />
                </Tabs.Content>
              ))}
            </Tabs.Root>
          ) : (
            <EmptyState
              actionLabel="新增分类"
              description="先创建一个分类，再把工作入口、AI 工具和常用站点放进去。"
              onAction={() => setDialog({ type: "category" })}
              title="还没有导航分类"
            />
          )}
        </div>
      </main>

      {/* ── Dialogs ── */}
      <Dialog.Root open={dialog?.type === "link"} onOpenChange={(open) => !open && setDialog(null)}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>{dialog?.type === "link" && dialog.link ? "编辑链接" : "新增链接"}</Dialog.Title>
          {dialog?.type === "link" ? (
            <LinkForm
              categories={categories}
              initialCategoryId={dialog.categoryId}
              initialValue={dialog.link}
              onCancel={() => setDialog(null)}
              onSubmit={handleSaveLink}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={dialog?.type === "category"} onOpenChange={(open) => !open && setDialog(null)}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>{dialog?.type === "category" && dialog.category ? "编辑分类" : "新增分类"}</Dialog.Title>
          {dialog?.type === "category" ? (
            <CategoryForm initialValue={dialog.category} onCancel={() => setDialog(null)} onSubmit={handleSaveCategory} />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={dialog?.type === "profile"} onOpenChange={(open) => !open && setDialog(null)}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>账号设置</Dialog.Title>
          <ProfileForm fallbackName={fallbackName} onCancel={() => setDialog(null)} onSubmit={handleSaveProfile} profile={profile} />
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialog.Content maxWidth="420px">
          <AlertDialog.Title>确认删除</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {deleteTarget && "links" in deleteTarget
              ? `删除分类「${deleteTarget.name}」会同时删除其中所有链接。`
              : deleteTarget
                ? `删除链接「${deleteTarget.title}」？`
                : ""}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel>
              <Button color="gray" variant="soft">
                取消
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button color="red" onClick={confirmDelete}>
                删除
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <Dialog.Root
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open && !importing) {
            setBookmarkFile(null);
            setImportResult("");
          }
        }}
      >
        <Dialog.Content maxWidth="460px">
          <Dialog.Title>导入收藏夹</Dialog.Title>
          <Dialog.Description size="2">
            选择浏览器导出的 HTML 收藏夹文件。导入时会按文件夹生成分类，重复链接保留第一次出现的，已存在的链接会自动跳过。
          </Dialog.Description>
          {importResult ? (
            <Callout.Root className="mt-4" color="green" size="1">
              <Callout.Text>{importResult}</Callout.Text>
            </Callout.Root>
          ) : null}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="truncate text-sm font-medium text-slate-950">{bookmarkFile?.name ?? "尚未选择文件"}</p>
            <p className="mt-1 text-xs text-slate-500">支持 .html 或 .htm</p>
            <input
              ref={bookmarkInputRef}
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={handleBookmarkFileChange}
              type="file"
            />
            <Button className="mt-3" disabled={importing} onClick={handleChooseBookmarkFile} type="button" variant="surface">
              <Upload size={16} />
              选择文件
            </Button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button color="gray" disabled={importing} onClick={() => setImportDialogOpen(false)} variant="soft">
              {importResult ? "关闭" : "取消"}
            </Button>
            <Button disabled={importing || !bookmarkFile} onClick={handleImportBookmarks}>
              {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              开始导入
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

function App() {
  return (
    <Theme accentColor="teal" grayColor="slate" radius="medium">
      <EditModeProvider>
        <AppContent />
      </EditModeProvider>
    </Theme>
  );
}

export default App;
