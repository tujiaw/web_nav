export type BingWallpaper = {
  url: string;
  title: string;
};

type BingArchiveResponse = {
  images?: Array<{
    copyright?: string;
    title?: string;
    url?: string;
  }>;
};

export async function fetchBingWallpaper(): Promise<BingWallpaper> {
  const response = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN", {
    headers: {
      "User-Agent": "web-nav/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Bing wallpaper fetch failed");
  }

  const payload = (await response.json()) as BingArchiveResponse;
  const image = payload.images?.[0];
  if (!image?.url) {
    throw new Error("Bing wallpaper not found");
  }

  return {
    url: image.url.startsWith("http") ? image.url : `https://www.bing.com${image.url}`,
    title: image.title || image.copyright || "Bing wallpaper",
  };
}
