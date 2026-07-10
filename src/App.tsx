import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Download,
  FolderPlus,
  Github,
  LayoutDashboard,
  Loader2,
  LogOut,
  Pencil,
  Upload,
  Plus,
  ShieldCheck,
  Sparkles,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import { AlertDialog, Button, Callout, Dialog, DropdownMenu, IconButton, Switch, Tabs, TextField, Theme, Tooltip } from "@radix-ui/themes";
import { CategorySection } from "./components/CategorySection";
import { AiOrganizeDialog } from "./components/AiOrganizeDialog";
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
  loadAllLinks,
  loadCategories,
  loadCategoryLinks,
  moveLinksToCategories,
  saveCategory,
  saveCategoryOrder,
  saveLink,
  searchLinks,
  upsertProfile,
} from "./lib/navStore";
import { isSupabaseConfigured } from "./lib/supabase";
import { parseBookmarkHtml } from "./lib/bookmarkImport";
import { normalizeUrl } from "./lib/url";
import { downloadNavigation } from "./lib/navigationExport";
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

function LoginScreen({ onContinueLocal, onEmailLogin, onLogin }: { onContinueLocal: () => void; onEmailLogin: (email: string) => Promise<void>; onLogin: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

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

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onEmailLogin(email);
      setEmailSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送登录邮件失败");
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
              <div className="space-y-4">
                <Button className="h-11 w-full bg-slate-950 font-semibold text-white hover:bg-slate-800" disabled={loading} onClick={handleLogin} size="3">
                  <Github size={18} />使用 GitHub 登录
                </Button>
                <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
                <form className="flex gap-2" onSubmit={handleEmailLogin}>
                  <TextField.Root className="min-w-0 flex-1" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
                  <Button disabled={loading || !email.trim()} type="submit" variant="soft">Email link</Button>
                </form>
                {emailSent ? <p className="text-sm text-teal-700">登录链接已发送，请检查邮箱。</p> : null}
                <Button className="w-full" color="gray" onClick={onContinueLocal} variant="ghost">无需登录，本地使用</Button>
              </div>
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

const GUEST_MODE_STORAGE_KEY = "web-nav-guest-mode";
const GUEST_NAVIGATION_STORAGE_KEY = "web-nav-local-navigation";

function cloneDefaultNavigation() {
  return defaultCategories.map((category) => ({ ...category, links: category.links.map((link) => ({ ...link })) }));
}

function loadGuestNavigation() {
  try {
    const stored = localStorage.getItem(GUEST_NAVIGATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) as NavCategory[] : cloneDefaultNavigation();
  } catch {
    return cloneDefaultNavigation();
  }
}

function AppContent() {
  const { loading: authLoading, signInWithEmail, signInWithGitHub, signOut, user } = useAuth();
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem(GUEST_MODE_STORAGE_KEY) === "true");
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [aiOrganizeOpen, setAiOrganizeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NavLink | NavCategory | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bookmarkFile, setBookmarkFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedCategoryIds, setLoadedCategoryIds] = useState<Set<string>>(() => new Set());
  const [loadingCategoryIds, setLoadingCategoryIds] = useState<Set<string>>(() => new Set());
  const [allLinksLoaded, setAllLinksLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [draggingCategoryId, setDraggingCategoryId] = useState("");
  const [bingWallpaperEnabled, setBingWallpaperEnabled] = useState(() => localStorage.getItem(BING_WALLPAPER_STORAGE_KEY) === "true");
  const [bingWallpaperUrl, setBingWallpaperUrl] = useState("");
  const bookmarkInputRef = useRef<HTMLInputElement | null>(null);
  const loadingCategoryIdsRef = useRef(new Set<string>());
  const allLinksPromiseRef = useRef<Promise<NavCategory[]> | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchDebounceRef = useRef<number | null>(null);
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

  const replaceCategoryLinks = useCallback((categoryId: string, links: NavLink[]) => {
    setCategories((current) =>
      current.map((category) => (category.id === categoryId ? { ...category, links } : category)),
    );
  }, []);

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
      const [nextProfile, nextCategories] = await Promise.all([getProfile(userId), loadCategories(userId)]);

      if (nextCategories.length === 0) {
        await createDefaultNavigation(userId, defaultCategories);
        setCategories(await loadCategories(userId));
      } else {
        setCategories(nextCategories);
      }
      setLoadedCategoryIds(new Set());
      loadingCategoryIdsRef.current.clear();
      setLoadingCategoryIds(new Set());
      allLinksPromiseRef.current = null;
      setAllLinksLoaded(false);

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

  const loadActiveCategoryLinks = useCallback(async (categoryId: string) => {
    if (!userId || guestMode || loadedCategoryIds.has(categoryId) || loadingCategoryIdsRef.current.has(categoryId)) {
      return;
    }

    loadingCategoryIdsRef.current.add(categoryId);
    setLoadingCategoryIds(new Set(loadingCategoryIdsRef.current));
    try {
      const links = await loadCategoryLinks(userId, categoryId);
      replaceCategoryLinks(categoryId, links);
      setLoadedCategoryIds((current) => new Set(current).add(categoryId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载分类链接失败");
    } finally {
      loadingCategoryIdsRef.current.delete(categoryId);
      setLoadingCategoryIds(new Set(loadingCategoryIdsRef.current));
    }
  }, [guestMode, loadedCategoryIds, replaceCategoryLinks, userId]);

  const ensureAllLinksLoaded = useCallback(async () => {
    if (guestMode || !userId || allLinksLoaded) {
      return categories;
    }
    if (allLinksPromiseRef.current) {
      return allLinksPromiseRef.current;
    }

    const loadPromise = (async () => {
      const links = await loadAllLinks(userId);
      const groupedLinks = new Map<string, NavLink[]>();
      links.forEach((link) => {
        const group = groupedLinks.get(link.categoryId) ?? [];
        group.push(link);
        groupedLinks.set(link.categoryId, group);
      });

      const nextCategories = categories.map((category) => ({
        ...category,
        links: (groupedLinks.get(category.id) ?? []).sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
      }));
      setCategories(nextCategories);
      setLoadedCategoryIds(new Set(nextCategories.map((category) => category.id)));
      setAllLinksLoaded(true);
      return nextCategories;
    })();
    allLinksPromiseRef.current = loadPromise;

    try {
      return await loadPromise;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载全部链接失败");
      return categories;
    } finally {
      allLinksPromiseRef.current = null;
    }
  }, [allLinksLoaded, categories, guestMode, userId]);

  const mergeLinksIntoCategories = useCallback((links: NavLink[]) => {
    if (links.length === 0) {
      return;
    }

    setCategories((current) =>
      current.map((category) => {
        const additions = links.filter((link) => link.categoryId === category.id);
        if (additions.length === 0) {
          return category;
        }

        const existingIds = new Set(category.links.map((link) => link.id));
        const mergedLinks = [
          ...category.links.filter((link) => !additions.some((addition) => addition.id === link.id)),
          ...additions.filter((link) => !existingIds.has(link.id) || category.links.some((item) => item.id === link.id)),
        ];

        return {
          ...category,
          links: mergedLinks.sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
        };
      }),
    );
  }, []);

  const handleSearchIntent = useCallback((query: string) => {
    if (guestMode || !userId || allLinksLoaded) {
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return;
    }

    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current);
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    searchDebounceRef.current = window.setTimeout(() => {
      void searchLinks(userId, trimmedQuery).then((links) => {
        if (searchRequestIdRef.current === requestId) {
          mergeLinksIntoCategories(links);
        }
      }).catch((reason) => {
        if (searchRequestIdRef.current === requestId) {
          setError(reason instanceof Error ? reason.message : "搜索链接失败");
        }
      });
    }, 250);
  }, [allLinksLoaded, guestMode, mergeLinksIntoCategories, userId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (guestMode && !userId) {
      const nextCategories = loadGuestNavigation();
      setCategories(nextCategories);
      setLoadedCategoryIds(new Set(nextCategories.map((category) => category.id)));
      setAllLinksLoaded(true);
      setProfile(null);
      setLoading(false);
      return;
    }

    if (!userId) {
      setCategories([]);
      setLoadedCategoryIds(new Set());
      setAllLinksLoaded(false);
      setLoading(false);
      return;
    }

    refresh();
  }, [authLoading, guestMode, refresh, userId]);

  useEffect(() => {
    if (guestMode && !userId && categories.length > 0) {
      localStorage.setItem(GUEST_NAVIGATION_STORAGE_KEY, JSON.stringify(categories));
    }
  }, [categories, guestMode, userId]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (!activeCategoryId) {
      return;
    }

    void loadActiveCategoryLinks(activeCategoryId);
  }, [activeCategoryId, loadActiveCategoryLinks]);

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

    if (guestMode) return;
    try {
      await incrementClicks(link);
    } catch {
      await loadActiveCategoryLinks(link.categoryId);
    }
  }

  async function handleSaveLink(value: LinkFormValue) {
    if (guestMode) {
      const now = new Date().toISOString();
      const nextLink: NavLink = { id: value.id ?? crypto.randomUUID(), title: value.title.trim(), url: normalizeUrl(value.url), iconUrl: value.iconUrl.trim() || undefined, iconDataUrl: value.iconDataUrl, description: value.description.trim(), categoryId: value.categoryId, clicks: 0, createdAt: now, updatedAt: now };
      setCategories((current) => current.map((category) => ({ ...category, links: category.id === value.categoryId ? [...category.links.filter((link) => link.id !== nextLink.id), nextLink] : category.links.filter((link) => link.id !== nextLink.id) })));
      setDialog(null);
      return;
    }
    if (!user) {
      return;
    }

    const savedLink = await saveLink(user.id, value);
    if (savedLink) {
      setCategories((current) =>
        current.map((category) => {
          const linksWithoutSaved = category.links.filter((link) => link.id !== savedLink.id);
          if (category.id !== savedLink.categoryId) {
            return { ...category, links: linksWithoutSaved };
          }
          return {
            ...category,
            links: [...linksWithoutSaved, savedLink].sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
          };
        }),
      );
      setLoadedCategoryIds((current) => new Set(current).add(savedLink.categoryId));
    }
    setDialog(null);
  }

  async function handleSaveCategory(value: CategoryFormValue) {
    if (guestMode) {
      setCategories((current) => value.id
        ? current.map((category) => category.id === value.id ? { ...category, name: value.name.trim() } : category)
        : [...current, { id: crypto.randomUUID(), name: value.name.trim(), sortOrder: Date.now(), links: [] }]);
      setDialog(null);
      return;
    }
    if (!user) {
      return;
    }

    const savedCategory = await saveCategory(user.id, value);
    if (savedCategory) {
      setCategories((current) => {
        const existing = current.find((category) => category.id === savedCategory.id);
        if (existing) {
          return current.map((category) =>
            category.id === savedCategory.id
              ? { ...category, name: savedCategory.name, sortOrder: savedCategory.sortOrder }
              : category,
          );
        }
        return [...current, savedCategory].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setLoadedCategoryIds((current) => new Set(current).add(savedCategory.id));
    }
    setDialog(null);
  }

  async function handleReorderCategory(targetCategoryId: string) {
    if ((!user && !guestMode) || !draggingCategoryId || draggingCategoryId === targetCategoryId) {
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

    if (guestMode) return;
    try {
      await saveCategoryOrder(user!.id, orderedCategories);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "调整分类顺序失败");
      await refresh({ showLoading: false });
    }
  }

  async function handleApplyAiOrganize(suggestions: Array<{ linkId: string; targetCategoryId: string }>) {
    if (!user) {
      return;
    }

    await moveLinksToCategories(
      user.id,
      suggestions.map((suggestion) => ({
        linkId: suggestion.linkId,
        categoryId: suggestion.targetCategoryId,
      })),
    );
    const targetByLinkId = new Map(suggestions.map((suggestion) => [suggestion.linkId, suggestion.targetCategoryId]));
    setCategories((current) => {
      const movedLinks: NavLink[] = [];
      const withoutMovedLinks = current.map((category) => ({
        ...category,
        links: category.links.filter((link) => {
          const targetCategoryId = targetByLinkId.get(link.id);
          if (!targetCategoryId) {
            return true;
          }
          movedLinks.push({ ...link, categoryId: targetCategoryId, updatedAt: new Date().toISOString() });
          return false;
        }),
      }));

      return withoutMovedLinks.map((category) => ({
        ...category,
        links: [
          ...category.links,
          ...movedLinks.filter((link) => link.categoryId === category.id),
        ].sort((a, b) => a.title.localeCompare(b.title, "zh-CN")),
      }));
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (guestMode) {
      setCategories((current) => "links" in deleteTarget
        ? current.filter((category) => category.id !== deleteTarget.id)
        : current.map((category) => ({ ...category, links: category.links.filter((link) => link.id !== deleteTarget.id) })));
      setDeleteTarget(null);
      return;
    }
    try {
      if ("links" in deleteTarget) {
        await deleteCategory(deleteTarget.id);
        setCategories((current) => current.filter((category) => category.id !== deleteTarget.id));
        setLoadedCategoryIds((current) => {
          const next = new Set(current);
          next.delete(deleteTarget.id);
          return next;
        });
      } else {
        await deleteLink(deleteTarget.id);
        setCategories((current) =>
          current.map((category) => ({
            ...category,
            links: category.links.filter((link) => link.id !== deleteTarget.id),
          })),
        );
      }

      setDeleteTarget(null);
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

  async function handleOpenAiOrganize() {
    await ensureAllLinksLoaded();
    setAiOrganizeOpen(true);
  }

  async function handleExportNavigation(format: "html" | "json") {
    const navigation = await ensureAllLinksLoaded();
    downloadNavigation(navigation, format);
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
    if (!userId && !guestMode) {
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
      if (guestMode) {
        const existingUrls = new Set(allLinks.map((link) => normalizeUrl(link.url)));
        let imported = 0;
        const additions = parsedCategories.map((category) => ({ ...category, links: category.links.filter((link) => {
          const url = normalizeUrl(link.url);
          if (existingUrls.has(url)) return false;
          existingUrls.add(url); imported += 1; return true;
        }) })).filter((category) => category.links.length > 0);
        setCategories((current) => [...current, ...additions]);
        setImportResult(`已导入 ${imported} 个链接、${additions.length} 个分类。`);
      } else {
        const result = await importNavigation(userId, parsedCategories);
        setImportResult(`已导入 ${result.links} 个链接、${result.categories} 个分类，跳过 ${result.skipped} 个重复链接。`);
        await refresh({ showLoading: false });
      }
      setBookmarkFile(null);
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

  if (!user && !guestMode) {
    return <LoginScreen onContinueLocal={() => { localStorage.setItem(GUEST_MODE_STORAGE_KEY, "true"); setGuestMode(true); }} onEmailLogin={signInWithEmail} onLogin={signInWithGitHub} />;
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
            <SearchPanel
              categories={categories}
              onAddLink={() => setDialog({ type: "link" })}
              onOpenLink={handleOpenLink}
              onSearchIntent={handleSearchIntent}
              userId={userId}
            />
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
                  <p className="truncate text-sm font-semibold text-slate-950">{guestMode ? "Local workspace" : profile?.username ?? fallbackName}</p>
                  <p className="truncate text-xs text-slate-400">{guestMode ? "Stored in this browser" : user?.email}</p>
                </div>
                {editMode ? (
                  <>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onSelect={() => void handleOpenAiOrganize()}>
                      <Sparkles size={15} />
                      AI 整理导航
                    </DropdownMenu.Item>
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
                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger><Download size={15} />导出数据</DropdownMenu.SubTrigger>
                      <DropdownMenu.SubContent>
                        <DropdownMenu.Item onSelect={() => void handleExportNavigation("html")}>浏览器书签 HTML</DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={() => void handleExportNavigation("json")}>Web Nav JSON</DropdownMenu.Item>
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Sub>
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
                {!guestMode ? <DropdownMenu.Item onSelect={() => setDialog({ type: "profile" })}><Settings size={15} />账号设置</DropdownMenu.Item> : null}
                <DropdownMenu.Separator />
                <DropdownMenu.Item color="red" onSelect={() => guestMode ? (localStorage.removeItem(GUEST_MODE_STORAGE_KEY), setGuestMode(false)) : void signOut()}>
                  <LogOut size={15} />
                  {guestMode ? "退出本地模式" : "退出登录"}
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
          <RecentLinks links={recentLinks} onOpen={handleOpenLink} userId={userId} />

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
                        <span className="ml-1 text-xs opacity-70">
                          {loadedCategoryIds.has(category.id) ? category.links.length : "..."}
                        </span>
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
                    isLoading={loadingCategoryIds.has(category.id) || !loadedCategoryIds.has(category.id)}
                    onAddLink={(categoryId) => setDialog({ type: "link", categoryId })}
                    onDeleteLink={setDeleteTarget}
                    onEditLink={(link) => setDialog({ type: "link", link })}
                    onOpenLink={handleOpenLink}
                    userId={userId}
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
      <AiOrganizeDialog
        categories={categories}
        onApply={handleApplyAiOrganize}
        onOpenChange={setAiOrganizeOpen}
        open={aiOrganizeOpen}
        userId={userId}
      />

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
