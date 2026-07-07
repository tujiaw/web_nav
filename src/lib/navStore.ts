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

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type LinkInsertRow = {
  user_id: string;
  category_id: string;
  title: string;
  url: string;
  icon_url?: string | null;
  description: string;
  clicks: number;
};

const linkInsertBatchSize = 25;

function isMissingIconColumn(error: unknown) {
  const reason = error as SupabaseErrorLike;
  return reason.code === "PGRST204" && reason.message?.includes("icon_url");
}

function stripIconUrl<T extends { icon_url?: string | null }>(row: T) {
  const rest = { ...row };
  delete rest.icon_url;
  return rest;
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

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    passwordHint: row.password_hint ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategories(categories: CategoryRow[], links: LinkRow[]): NavCategory[] {
  return categories
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      links: links
        .filter((link) => link.category_id === category.id)
        .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
        .map(
          (link): NavLink => ({
            id: link.id,
            title: link.title,
            url: link.url,
            iconUrl: link.icon_url ?? undefined,
            description: link.description ?? "",
            categoryId: link.category_id,
            clicks: link.clicks,
            createdAt: link.created_at,
            updatedAt: link.updated_at,
          }),
        ),
    }));
}

export async function getProfile(userId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
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
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function loadNavigation(userId: string) {
  if (!supabase) {
    return [];
  }

  const [{ data: categories, error: categoryError }, { data: links, error: linkError }] =
    await Promise.all([
      supabase.from("categories").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("links").select("*").eq("user_id", userId),
    ]);

  if (categoryError) {
    throw categoryError;
  }
  if (linkError) {
    throw linkError;
  }

  return mapCategories(categories ?? [], links ?? []);
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

  const linkRows = categories.flatMap((category, categoryIndex) =>
    category.links.map((link) => ({
      user_id: userId,
      category_id: categoryRows[categoryIndex].id,
      title: link.title,
      url: normalizeUrl(link.url),
      icon_url: link.iconUrl ?? null,
      description: link.description ?? "",
      clicks: 0,
    })),
  );

  const { error: categoryError } = await supabase.from("categories").insert(categoryRows);
  if (categoryError) {
    throw categoryError;
  }

  await insertLinkRows(linkRows);
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

  const linkRows = dedupedCategories.flatMap((category, categoryIndex) =>
    category.links.map((link) => ({
      user_id: userId,
      category_id: categoryRows[categoryIndex].id,
      title: link.title,
      url: normalizeUrl(link.url),
      icon_url: link.iconUrl ?? null,
      description: link.description ?? "",
      clicks: 0,
    })),
  );

  const { error: categoryError } = await supabase.from("categories").insert(categoryRows);
  if (categoryError) {
    throw categoryError;
  }

  if (linkRows.length === 0) {
    return { categories: categoryRows.length, links: 0, skipped };
  }

  await insertLinkRows(linkRows);
  return { categories: categoryRows.length, links: linkRows.length, skipped };
}

export async function saveCategory(userId: string, value: CategoryFormValue) {
  if (!supabase) {
    return;
  }

  const payload = {
    id: value.id ?? crypto.randomUUID(),
    user_id: userId,
    name: value.name.trim(),
    sort_order: value.sortOrder ?? Date.now(),
    updated_at: new Date().toISOString(),
  };

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
    return;
  }

  const payload = {
    id: value.id ?? crypto.randomUUID(),
    user_id: userId,
    category_id: value.categoryId,
    title: value.title.trim(),
    url: normalizeUrl(value.url),
    icon_url: value.iconUrl.trim() || null,
    description: value.description.trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("links").upsert(payload);
  if (error) {
    if (!isMissingIconColumn(error)) {
      throw error;
    }

    const { error: retryError } = await supabase.from("links").upsert(stripIconUrl(payload));
    if (retryError) {
      throw retryError;
    }
  }
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
