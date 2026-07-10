import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Globe2, Plus, Search } from "lucide-react";
import { Button, Select, TextField } from "@radix-ui/themes";
import { searchProviders } from "../data/defaults";
import { getHostname } from "../lib/url";
import type { NavCategory, NavLink } from "../types";
import { LinkIcon } from "./LinkIcon";

type SearchPanelProps = {
  categories: NavCategory[];
  onAddLink: () => void;
  onSearchIntent?: (query: string) => void;
  onOpenLink: (link: NavLink) => void;
  userId?: string;
};

type SearchResult = { categoryName: string; link: NavLink; score: number };

function fuzzyScore(query: string, text: string) {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const normalizedText = text.toLocaleLowerCase();
  if (!normalizedQuery) return 0;
  const directIndex = normalizedText.indexOf(normalizedQuery);
  if (directIndex >= 0) return 1000 - directIndex;

  let queryIndex = 0;
  let gap = 0;
  for (let textIndex = 0; textIndex < normalizedText.length && queryIndex < normalizedQuery.length; textIndex += 1) {
    if (normalizedText[textIndex] === normalizedQuery[queryIndex]) queryIndex += 1;
    else if (queryIndex > 0) gap += 1;
  }
  return queryIndex === normalizedQuery.length ? Math.max(1, 500 - gap) : -1;
}

export function SearchPanel({ categories, onAddLink, onOpenLink, onSearchIntent, userId }: SearchPanelProps) {
  const [providerId, setProviderId] = useState(searchProviders[0].id);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const provider = useMemo(() => searchProviders.find((item) => item.id === providerId) ?? searchProviders[0], [providerId]);
  const siteResults = useMemo<SearchResult[]>(() => {
    const value = query.trim();
    if (!value) return [];
    return categories
      .flatMap((category) => category.links.map((link) => ({
        categoryName: category.name,
        link,
        score: fuzzyScore(value, `${link.title} ${link.url} ${link.description ?? ""} ${category.name}`),
      })))
      .filter((result) => result.score >= 0)
      .sort((a, b) => b.score - a.score || b.link.clicks - a.link.clicks)
      .slice(0, 8);
  }, [categories, query]);
  const showResults = focused && query.trim().length > 0;

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (!isTyping && event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      } else if (!isTyping && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onAddLink();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onAddLink]);

  useEffect(() => setActiveIndex(0), [query]);

  function searchWeb() {
    const value = query.trim();
    if (value) window.open(`${provider.searchUrl}${encodeURIComponent(value)}`, "_blank", "noopener,noreferrer");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (siteResults[activeIndex]) {
      setFocused(false);
      onOpenLink(siteResults[activeIndex].link);
      return;
    }
    searchWeb();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, siteResults.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <form className="relative flex w-full max-w-2xl items-center gap-2" onSubmit={handleSubmit}>
      <div className="w-24 shrink-0">
        <Select.Root onValueChange={setProviderId} value={providerId}>
          <Select.Trigger className="w-full" />
          <Select.Content>{searchProviders.map((item) => <Select.Item key={item.id} value={item.id}>{item.name}</Select.Item>)}</Select.Content>
        </Select.Root>
      </div>
      <TextField.Root
        aria-autocomplete="list"
        aria-controls="web-nav-search-results"
        aria-expanded={showResults}
        className="min-w-0 flex-1"
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          onSearchIntent?.(nextQuery);
        }}
        onFocus={() => {
          setFocused(true);
          onSearchIntent?.(query);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search links or the web…"
        ref={inputRef}
        size="2"
        value={query}
      >
        <TextField.Slot><Search size={16} /></TextField.Slot>
        <TextField.Slot><kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">Ctrl K</kbd></TextField.Slot>
      </TextField.Root>
      <Button className="shrink-0 bg-slate-900 font-semibold text-white hover:bg-slate-800" size="2" type="submit">搜索</Button>
      {showResults ? (
        <div className="absolute left-24 right-[72px] top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" id="web-nav-search-results" role="listbox">
          {siteResults.map((result, index) => (
            <button className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${index === activeIndex ? "bg-teal-50" : "hover:bg-slate-50"}`} key={result.link.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onOpenLink(result.link)} role="option" type="button">
              <LinkIcon className="h-5 w-5 rounded" link={result.link} userId={userId} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{result.link.title}</span><span className="block truncate text-xs text-slate-400">{result.categoryName} · {getHostname(result.link.url)}</span></span>
              <ArrowUpRight className="text-slate-400" size={14} />
            </button>
          ))}
          <button className={`flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-left ${activeIndex === siteResults.length ? "bg-teal-50" : "hover:bg-slate-50"}`} onMouseDown={(event) => event.preventDefault()} onClick={searchWeb} type="button">
            <Globe2 size={18} className="text-slate-500" /><span className="min-w-0 flex-1 truncate text-sm">Search “{query}” with {provider.name}</span>
          </button>
          <button className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50" onMouseDown={(event) => event.preventDefault()} onClick={onAddLink} type="button"><Plus size={18} />Add a new link <kbd className="ml-auto text-xs">N</kbd></button>
        </div>
      ) : null}
    </form>
  );
}
