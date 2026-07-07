import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Select, TextField } from "@radix-ui/themes";
import { searchProviders } from "../data/defaults";

type SearchPanelProps = {
  /** 搜索过滤回调：输入变化时实时通知父组件过滤链接 */
  onFilterChange?: (query: string) => void;
};

export function SearchPanel({ onFilterChange }: SearchPanelProps) {
  const [providerId, setProviderId] = useState(searchProviders[0].id);
  const [query, setQuery] = useState("");
  const provider = useMemo(
    () => searchProviders.find((item) => item.id === providerId) ?? searchProviders[0],
    [providerId],
  );

  function handleChange(value: string) {
    setQuery(value);
    onFilterChange?.(value);
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
    <form className="flex w-full max-w-xl items-center gap-2" onSubmit={handleSubmit}>
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
        onChange={(event) => handleChange(event.target.value)}
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
    </form>
  );
}
