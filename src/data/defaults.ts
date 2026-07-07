import type { NavCategory, SearchProvider } from "../types";

const now = new Date().toISOString();

export const searchProviders: SearchProvider[] = [
  {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q=",
    placeholder: "用 Google 搜索",
  },
  {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q=",
    placeholder: "用 Bing 搜索",
  },
  {
    id: "baidu",
    name: "Baidu",
    searchUrl: "https://www.baidu.com/s?wd=",
    placeholder: "用百度搜索",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    searchUrl: "https://www.perplexity.ai/search?q=",
    placeholder: "用 AI 搜索答案",
  },
];

export const defaultCategories: NavCategory[] = [
  {
    id: "work",
    name: "工作常用",
    sortOrder: 1,
    links: [
      {
        id: "github",
        title: "GitHub",
        url: "https://github.com",
        iconUrl: "https://github.com/favicon.ico",
        description: "代码仓库与协作",
        categoryId: "work",
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "vercel",
        title: "Vercel",
        url: "https://vercel.com",
        iconUrl: "https://vercel.com/favicon.ico",
        description: "前端部署平台",
        categoryId: "work",
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
  {
    id: "ai",
    name: "AI 工具",
    sortOrder: 2,
    links: [
      {
        id: "chatgpt",
        title: "ChatGPT",
        url: "https://chatgpt.com",
        iconUrl: "https://chatgpt.com/favicon.ico",
        description: "AI 助手",
        categoryId: "ai",
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "claude",
        title: "Claude",
        url: "https://claude.ai",
        iconUrl: "https://claude.ai/favicon.ico",
        description: "AI 写作与分析",
        categoryId: "ai",
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
  {
    id: "learning",
    name: "学习资料",
    sortOrder: 3,
    links: [
      {
        id: "mdn",
        title: "MDN",
        url: "https://developer.mozilla.org",
        iconUrl: "https://developer.mozilla.org/favicon.ico",
        description: "Web 开发文档",
        categoryId: "learning",
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
];
