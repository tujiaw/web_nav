import { supabase } from "./supabase";
import { getUrlDedupeKey, normalizeUrl } from "./url";
import type { CategoryFormValue, LinkFormValue, NavCategory, NavLink, Profile } from "../types";

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type LinkRow = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  url: string;
  icon_url: string | null;
  description: string | null;
  clicks: number;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
  password_hint: string | null;
  created_at: string;
  updated_at: string;
};

type UserConfigRow = {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
};

type LinkIconRow = {
  link_id: string;
  user_id: string;
  icon_data: string;
  created_at: string;
  updated_at: string;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type LinkInsertRow = {
  id?: string;
  user_id: string;
  category_id: string;
  title: string;
  url: string;
  icon_url?: string | null;
  description: string;
  clicks: number;
};

type LinkIconInsertRow = {
  link_id: string;
  user_id: string;
  icon_data: string;
};

const linkInsertBatchSize = 25;
const profileSelectColumns = "id,username,password_hint,created_at,updated_at";
const categorySelectColumns = "id,user_id,name,sort_order,created_at,updated_at";
const linkSelectColumns =
  "id,user_id,category_id,title,url,icon_url,description,clicks,created_at,updated_at";

function isMissingIconColumn(error: unknown) {
  const reason = error as SupabaseErrorLike;
  return reason.code === "PGRST204" && reason.message?.includes("icon_url");
}

function isMissingLinkIconsTable(error: unknown) {
  const reason = error as SupabaseErrorLike;
  return reason.code === "42P01" || reason.message?.includes("link_icons");
}

function stripIconUrl<T extends { icon_url?: string | null }>(row: T) {
  const rest = { ...row };
  delete rest.icon_url;
  return rest;
}

function isDataImageUrl(value?: string | null) {
  return /^data:image\//i.test(value?.trim() ?? "");
}

function getPersistedIconUrl(value?: string | null) {
  const iconUrl = value?.trim() ?? "";
  return iconUrl && !isDataImageUrl(iconUrl) ? iconUrl : null;
}

function getIconDataUrl(value?: string | null) {
  const iconDataUrl = value?.trim() ?? "";
  return isDataImageUrl(iconDataUrl) ? iconDataUrl : "";
}

function getDatabaseLinkId(id?: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? "")
    ? id!
    : crypto.randomUUID();
}

function toBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function insertLinkRows(linkRows: LinkInsertRow[]) {
  if (!supabase || linkRows.length === 0) {
    return;
  }

  for (const batch of toBatches(linkRows, linkInsertBatchSize)) {
    const { error } = await supabase.from("links").insert(batch);
    if (!error) {
      continue;
    }

    if (!isMissingIconColumn(error)) {
      throw error;
    }

    const { error: retryError } = await supabase.from("links").insert(batch.map(stripIconUrl));
    if (retryError) {
      throw retryError;
    }
  }
}

async function upsertLinkIconRows(iconRows: LinkIconInsertRow[]) {
  if (!supabase || iconRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("link_icons").upsert(
    iconRows.map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    })),
  );

  if (error) {
    if (isMissingLinkIconsTable(error)) {
      return;
    }
    throw error;
  }
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    passwordHint: row.password_hint ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLink(row: LinkRow): NavLink {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    iconUrl: row.icon_url ?? undefined,
    description: row.description ?? "",
    categoryId: row.category_id,
    clicks: row.clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategory(row: CategoryRow, links: NavLink[] = []): NavCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    links,
  };
}

function mapCategories(categories: CategoryRow[], links: LinkRow[]): NavCategory[] {
  return categories
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) =>
      mapCategory(
        category,
        links
          .filter((link) => link.category_id === category.id)
          .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
          .map(mapLink),
      ),
    );
}

export async function getProfile(userId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelectColumns)
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return data ? mapProfile(data) : null;
}

export async function upsertProfile(userId: string, username: string, passwordHint: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      username,
      password_hint: passwordHint,
      updated_at: new Date().toISOString(),
    })
    .select(profileSelectColumns)
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function getUserConfig<T>(userId: string, key: string): Promise<T | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_configs")
    .select("*")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? ((data as UserConfigRow).value as T) : null;
}

export async function saveUserConfig<T>(userId: string, key: string, value: T) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("user_configs").upsert({
    user_id: userId,
    key,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function loadNavigation(userId: string) {
  if (!supabase) {
    return [];
  }

  const [{ data: categories, error: categoryError }, { data: links, error: linkError }] =
    await Promise.all([
      supabase.from("categories").select(categorySelectColumns).eq("user_id", userId).order("sort_order"),
      supabase.from("links").select(linkSelectColumns).eq("user_id", userId),
    ]);

  if (categoryError) {
    throw categoryError;
  }
  if (linkError) {
    throw linkError;
  }

  return mapCategories(categories ?? [], links ?? []);
}

export async function loadCategories(userId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("categories")
    .select(categorySelectColumns)
    .eq("user_id", userId)
    .order("sort_order");

  if (error) {
    throw error;
  }

  return (data ?? []).map((category) => mapCategory(category));
}

export async function loadCategoryLinks(userId: string, categoryId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("links")
    .select(linkSelectColumns)
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .order("title");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapLink);
}

export async function loadAllLinks(userId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from("links").select(linkSelectColumns).eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapLink);
}

export async function searchLinks(userId: string, query: string, limit = 12) {
  if (!supabase) {
    return [];
  }

  const term = query.trim().replace(/[%_,()]/g, " ");
  if (term.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("links")
    .select(linkSelectColumns)
    .eq("user_id", userId)
    .or(`title.ilike.%${term}%,url.ilike.%${term}%,description.ilike.%${term}%`)
    .order("clicks", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapLink);
}

export async function loadLinkIconData(userId: string, linkId: string) {
  if (!supabase) {
    return "";
  }

  const { data, error } = await supabase
    .from("link_icons")
    .select("icon_data")
    .eq("user_id", userId)
    .eq("link_id", linkId)
    .maybeSingle();

  if (error) {
    if (isMissingLinkIconsTable(error)) {
      return "";
    }
    throw error;
  }

  return ((data as Pick<LinkIconRow, "icon_data"> | null)?.icon_data ?? "").trim();
}

export async function createDefaultNavigation(userId: string, categories: NavCategory[]) {
  if (!supabase) {
    return;
  }

  const categoryRows = categories.map((category) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name: category.name,
    sort_order: category.sortOrder,
  }));

  const linksWithDatabaseIds = categories.flatMap((category, categoryIndex) =>
    category.links.map((link) => ({
      categoryId: categoryRows[categoryIndex].id,
      databaseId: getDatabaseLinkId(link.id),
      link,
    })),
  );
  const linkRows = linksWithDatabaseIds.map(({ categoryId, databaseId, link }) => ({
    id: databaseId,
    user_id: userId,
    category_id: categoryId,
    title: link.title,
    url: normalizeUrl(link.url),
    icon_url: getPersistedIconUrl(link.iconUrl),
    description: link.description ?? "",
    clicks: 0,
  }));
  const iconRows = linksWithDatabaseIds
      .map(({ databaseId, link }) => ({
        link_id: databaseId,
        user_id: userId,
        icon_data: getIconDataUrl(link.iconDataUrl ?? link.iconUrl),
      }))
      .filter((row) => row.icon_data);

  const { error: categoryError } = await supabase.from("categories").insert(categoryRows);
  if (categoryError) {
    throw categoryError;
  }

  await insertLinkRows(linkRows);
  await upsertLinkIconRows(iconRows);
}

export async function importNavigation(userId: string, categories: NavCategory[]) {
  if (!supabase || categories.length === 0) {
    return { categories: 0, links: 0, skipped: 0 };
  }

  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("links")
    .select("url")
    .eq("user_id", userId);

  if (existingLinksError) {
    throw existingLinksError;
  }

  const seenUrls = new Set((existingLinks ?? []).map((link) => getUrlDedupeKey(link.url)));
  let skipped = 0;
  const dedupedCategories = categories
    .map((category) => ({
      ...category,
      links: category.links.filter((link) => {
        const dedupeKey = getUrlDedupeKey(link.url);
        if (seenUrls.has(dedupeKey)) {
          skipped += 1;
          return false;
        }
        seenUrls.add(dedupeKey);
        return true;
      }),
    }))
    .filter((category) => category.links.length > 0);

  if (dedupedCategories.length === 0) {
    return { categories: 0, links: 0, skipped };
  }

  const categoryRows = dedupedCategories.map((category, index) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name: category.name,
    sort_order: Date.now() + index,
  }));

  const linksWithDatabaseIds = dedupedCategories.flatMap((category, categoryIndex) =>
    category.links.map((link) => ({
      categoryId: categoryRows[categoryIndex].id,
      databaseId: getDatabaseLinkId(link.id),
      link,
    })),
  );
  const linkRows = linksWithDatabaseIds.map(({ categoryId, databaseId, link }) => ({
    id: databaseId,
    user_id: userId,
    category_id: categoryId,
    title: link.title,
    url: normalizeUrl(link.url),
    icon_url: getPersistedIconUrl(link.iconUrl),
    description: link.description ?? "",
    clicks: 0,
  }));
  const iconRows = linksWithDatabaseIds
      .map(({ databaseId, link }) => ({
        link_id: databaseId,
        user_id: userId,
        icon_data: getIconDataUrl(link.iconDataUrl ?? link.iconUrl),
      }))
      .filter((row) => row.icon_data);

  const { error: categoryError } = await supabase.from("categories").insert(categoryRows);
  if (categoryError) {
    throw categoryError;
  }

  if (linkRows.length === 0) {
    return { categories: categoryRows.length, links: 0, skipped };
  }

  await insertLinkRows(linkRows);
  await upsertLinkIconRows(iconRows);
  return { categories: categoryRows.length, links: linkRows.length, skipped };
}

export async function saveCategory(userId: string, value: CategoryFormValue) {
  if (!supabase) {
    return null;
  }

  const payload = {
    id: value.id ?? crypto.randomUUID(),
    user_id: userId,
    name: value.name.trim(),
    sort_order: value.sortOrder ?? Date.now(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("categories").upsert(payload).select(categorySelectColumns).single();
  if (error) {
    throw error;
  }

  return mapCategory(data);
}

export async function saveCategoryOrder(userId: string, categories: NavCategory[]) {
  if (!supabase) {
    return;
  }

  const baseOrder = Date.now();
  const payload = categories.map((category, index) => ({
    id: category.id,
    user_id: userId,
    name: category.name,
    sort_order: baseOrder + index,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("categories").upsert(payload);
  if (error) {
    throw error;
  }
}

export async function deleteCategory(categoryId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) {
    throw error;
  }
}

export async function saveLink(userId: string, value: LinkFormValue) {
  if (!supabase) {
    return null;
  }

  const payload = {
    id: value.id ?? crypto.randomUUID(),
    user_id: userId,
    category_id: value.categoryId,
    title: value.title.trim(),
    url: normalizeUrl(value.url),
    icon_url: getPersistedIconUrl(value.iconUrl),
    description: value.description.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("links").upsert(payload).select(linkSelectColumns).single();
  if (error) {
    if (!isMissingIconColumn(error)) {
      throw error;
    }

    const { data: retryData, error: retryError } = await supabase
      .from("links")
      .upsert(stripIconUrl(payload))
      .select(linkSelectColumns)
      .single();
    if (retryError) {
      throw retryError;
    }
    const iconDataUrl = getIconDataUrl(value.iconDataUrl ?? value.iconUrl);
    if (iconDataUrl) {
      await upsertLinkIconRows([{ link_id: retryData.id, user_id: userId, icon_data: iconDataUrl }]);
    }
    return mapLink(retryData);
  }

  const iconDataUrl = getIconDataUrl(value.iconDataUrl ?? value.iconUrl);
  if (iconDataUrl) {
    await upsertLinkIconRows([{ link_id: data.id, user_id: userId, icon_data: iconDataUrl }]);
  }

  return mapLink(data);
}

export async function deleteLink(linkId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("links").delete().eq("id", linkId);
  if (error) {
    throw error;
  }
}

export async function moveLinksToCategories(
  userId: string,
  updates: Array<{ linkId: string; categoryId: string }>,
) {
  if (!supabase || updates.length === 0) {
    return;
  }

  const client = supabase;
  await Promise.all(
    updates.map(async (update) => {
      const { error } = await client
        .from("links")
        .update({
          category_id: update.categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.linkId)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
    }),
  );
}

export async function incrementClicks(link: NavLink) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("links")
    .update({ clicks: link.clicks + 1, updated_at: new Date().toISOString() })
    .eq("id", link.id);

  if (error) {
    throw error;
  }
}
