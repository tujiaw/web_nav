import { normalizeUrl } from "./url";

export type LinkMetadataResult = {
  title: string;
  iconUrl: string;
  url: string;
};

export async function inspectLinkMetadata(url: string): Promise<LinkMetadataResult> {
  const normalizedUrl = normalizeUrl(url);
  const response = await fetch(`/api/link-metadata?url=${encodeURIComponent(normalizedUrl)}`);
  const data = (await response.json()) as Partial<LinkMetadataResult> & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "链接检查失败");
  }

  return {
    title: data.title ?? "",
    iconUrl: data.iconUrl ?? "",
    url: data.url ?? normalizedUrl,
  };
}
