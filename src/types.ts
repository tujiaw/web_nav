export type SearchProvider = {
  id: string;
  name: string;
  searchUrl: string;
  placeholder: string;
};

export type NavLink = {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  iconDataUrl?: string;
  description?: string;
  categoryId: string;
  clicks: number;
  createdAt: string;
  updatedAt: string;
};

export type NavCategory = {
  id: string;
  name: string;
  sortOrder: number;
  links: NavLink[];
};

export type Profile = {
  id: string;
  username: string;
  passwordHint: string;
  createdAt: string;
  updatedAt: string;
};

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  disableThinking?: boolean;
  model: string;
  providerName: string;
};

export type LinkFormValue = {
  id?: string;
  title: string;
  url: string;
  iconUrl: string;
  iconDataUrl?: string;
  description: string;
  categoryId: string;
};

export type CategoryFormValue = {
  id?: string;
  name: string;
  sortOrder?: number;
};
