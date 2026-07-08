import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Select, TextField } from "@radix-ui/themes";
import { searchProviders } from "../data/defaults";
import { getHostname, getLinkIconUrl } from "../lib/url";
import type { NavLink } from "../types";

type SearchPanelProps = {
  links: NavLink[];
  onOpenLink: (link: NavLink) => void;
};

export function SearchPanel({ links, onOpenLink }: SearchPanelProps) {
  const [providerId, setProviderId] = useState(searchProviders[0].id);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const provider = useMemo(
    () => searchProviders.find((item) => item.id === providerId) ?? searchProviders[0],
    [providerId],
  );
  const siteResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return [];
    }

    return links
      .filter((link) => {
        const haystack = `${link.title} ${link.url} ${link.description ?? ""}`.toLowerCase();
        return haystack.includes(value);
      })
      .slice(0, 8);
  }, [links, query]);
  const showSiteResults = focused && siteResults.length > 0;

  function handleChange(value: string) {
    setQuery(value);
  }

  function handleOpenResult(link: NavLink) {
    setFocused(false);
    onOpenLink(link);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      return;
    }

    window.open(`${provider.searchUrl}${encodeURIComponent(value)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="relative flex w-full max-w-xl items-center gap-2" onSubmit={handleSubmit}>
      <div className="shrink-0 w-24">
        <Select.Root onValueChange={setProviderId} value={providerId}>
          <Select.Trigger className="w-full" />
          <Select.Content>
            {searchProviders.map((item) => (
              <Select.Item key={item.id} value={item.id}>
                {item.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
      <TextField.Root
        className="min-w-0 flex-1"
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={provider.placeholder}
        size="2"
        value={query}
      >
        <TextField.Slot>
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>
      <Button className="shrink-0 bg-slate-900 font-semibold text-white hover:bg-slate-800" size="2" type="submit">
        搜索
      </Button>
      {showSiteResults ? (
        <div className="absolute left-24 right-[72px] top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_48px_-28px_rgba(15,23,42,0.45)]">
          {siteResults.map((link) => (
            <button
              className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50"
              key={link.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleOpenResult(link)}
              type="button"
            >
              <img
                alt=""
                className="h-5 w-5 shrink-0 rounded"
                loading="lazy"
                src={getLinkIconUrl(link.url, link.iconUrl)}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><rect width="24" height="24" rx="4"/><path d="M10 6h8v8h-2V9.4L9.4 16 8 14.6 14.6 8H10V6z" fill="%23fff"/></svg>`;
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{link.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">{getHostname(link.url)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
