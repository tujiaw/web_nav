import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button, Callout, Checkbox, Dialog, IconButton, Switch, TextField } from "@radix-ui/themes";
import { getUserConfig, saveUserConfig } from "../lib/navStore";
import type { LlmConfig, NavCategory } from "../types";

const llmConfigKey = "llm.default";

type Suggestion = {
  linkId: string;
  reason: string;
  targetCategoryId: string;
};

type AiOrganizeDialogProps = {
  categories: NavCategory[];
  onApply: (suggestions: Suggestion[]) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  userId: string;
};

const defaultConfig: LlmConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  disableThinking: true,
  model: "",
  providerName: "OpenAI Compatible",
};

export function AiOrganizeDialog({ categories, onApply, onOpenChange, open, userId }: AiOrganizeDialogProps) {
  const [config, setConfig] = useState<LlmConfig>(defaultConfig);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const selectedCategories = useMemo(
    () => categories.filter((category) => selectedCategoryIds.includes(category.id)),
    [categories, selectedCategoryIds],
  );
  const linkById = useMemo(
    () => new Map(categories.flatMap((category) => category.links.map((link) => [link.id, { category, link }]))),
    [categories],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter((suggestion) => {
        const source = linkById.get(suggestion.linkId);
        return source && source.link.categoryId !== suggestion.targetCategoryId;
      }),
    [linkById, suggestions],
  );

  useEffect(() => {
    if (!open || configLoaded || !userId) {
      return;
    }

    async function loadConfig() {
      try {
        const savedConfig = await getUserConfig<LlmConfig>(userId, llmConfigKey);
        setConfig({ ...defaultConfig, ...(savedConfig ?? {}) });
        setConfigLoaded(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "加载模型配置失败");
      }
    }

    void loadConfig();
  }, [configLoaded, open, userId]);

  useEffect(() => {
    if (!open) {
      setError("");
      setRunning(false);
      setApplying(false);
      setSuggestions([]);
      setSelectedSuggestionIds([]);
    }
  }, [open]);

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    );
  }

  function toggleSuggestion(linkId: string) {
    setSelectedSuggestionIds((current) =>
      current.includes(linkId) ? current.filter((id) => id !== linkId) : [...current, linkId],
    );
  }

  async function handleSaveConfig(event: FormEvent) {
    event.preventDefault();
    setConfigSaving(true);
    setError("");
    try {
      await saveUserConfig(userId, llmConfigKey, config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存模型配置失败");
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleRun() {
    if (selectedCategories.length === 0) {
      setError("请先选择至少一个分类");
      return;
    }
    if (!config.apiKey.trim() || !config.model.trim()) {
      setError("请先配置 API Key 和模型名称");
      return;
    }

    setRunning(true);
    setError("");
    setSuggestions([]);
    setSelectedSuggestionIds([]);
    try {
      const response = await fetch("/api/ai-organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          sourceCategories: selectedCategories.map((category) => ({
            id: category.id,
            name: category.name,
            links: category.links.map((link) => ({
              id: link.id,
              title: link.title,
              url: link.url,
              description: link.description ?? "",
            })),
          })),
          targetCategories: categories.map((category) => ({
            id: category.id,
            name: category.name,
          })),
        }),
      });
      const payload = await response.json() as { error?: string; items?: Suggestion[] };
      if (!response.ok) {
        throw new Error(payload.error || "AI 整理失败");
      }
      const nextSuggestions = payload.items ?? [];
      setSuggestions(nextSuggestions);
      setSelectedSuggestionIds(nextSuggestions.map((item) => item.linkId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 整理失败");
    } finally {
      setRunning(false);
    }
  }

  async function handleApply() {
    const selected = visibleSuggestions.filter((suggestion) => selectedSuggestionIds.includes(suggestion.linkId));
    if (selected.length === 0) {
      setError("请先选择要确认的整理项");
      return;
    }

    setApplying(true);
    setError("");
    try {
      await onApply(selected);
      setSuggestions([]);
      setSelectedSuggestionIds([]);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "应用整理结果失败");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen && onOpenChange(true)}>
      <Dialog.Content
        maxWidth="880px"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-3">
          <Dialog.Title className="mb-0">AI 整理导航</Dialog.Title>
          <IconButton
            aria-label="关闭"
            disabled={applying || configSaving || running}
            onClick={() => onOpenChange(false)}
            size="2"
            variant="ghost"
          >
            <X size={16} />
          </IconButton>
        </div>
        <div className="grid gap-5 pt-2">
          {error ? (
            <Callout.Root color="red" size="1">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : null}

          <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3" onSubmit={handleSaveConfig}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                服务商名称
                <TextField.Root
                  onChange={(event) => setConfig((current) => ({ ...current, providerName: event.target.value }))}
                  value={config.providerName}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                模型名称
                <TextField.Root
                  onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}
                  placeholder="gpt-4o-mini / deepseek-chat"
                  value={config.model}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Base URL
                <TextField.Root
                  onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  value={config.baseUrl}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                API Key
                <TextField.Root
                  onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                  type="password"
                  value={config.apiKey}
                />
              </label>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <span>
                <span className="block">禁用 Thinking 模式</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-400">兼容支持该参数的推理模型，整理结果只保留最终 JSON。</span>
              </span>
              <Switch
                checked={config.disableThinking !== false}
                onCheckedChange={(checked) => setConfig((current) => ({ ...current, disableThinking: checked }))}
              />
            </label>
            <div className="flex justify-end">
              <Button disabled={configSaving} size="2" type="submit" variant="soft">
                {configSaving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                保存模型配置
              </Button>
            </div>
          </form>

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">待整理范围</h3>
                <p className="mt-0.5 text-xs text-slate-400">只整理勾选分类中的链接，目标分类可从全部已有分类中选择。</p>
              </div>
              <Button disabled={running} onClick={handleRun} size="2">
                {running ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                生成整理建议
              </Button>
            </div>
            <div className="grid max-h-40 grid-cols-1 gap-2 overflow-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <label className="flex items-center gap-2 text-sm text-slate-700" key={category.id}>
                  <Checkbox checked={selectedCategoryIds.includes(category.id)} onCheckedChange={() => toggleCategory(category.id)} />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="text-xs text-slate-400">{category.links.length}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">整理结果</h3>
              <Button disabled={applying || visibleSuggestions.length === 0} onClick={handleApply} size="2">
                {applying ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                批量确认
              </Button>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
              {visibleSuggestions.length > 0 ? (
                visibleSuggestions.map((suggestion) => {
                  const source = linkById.get(suggestion.linkId);
                  const targetCategory = categoryById.get(suggestion.targetCategoryId);
                  if (!source || !targetCategory) {
                    return null;
                  }
                  return (
                    <label className="grid gap-1 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={suggestion.linkId}>
                      <span className="flex items-start gap-2">
                        <Checkbox
                          checked={selectedSuggestionIds.includes(suggestion.linkId)}
                          onCheckedChange={() => toggleSuggestion(suggestion.linkId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-900">{source.link.title}</span>
                          <span className="block text-xs text-slate-500">
                            {source.category.name} → {targetCategory.name}
                          </span>
                        </span>
                      </span>
                      <span className="pl-6 text-xs leading-5 text-slate-400">{suggestion.reason}</span>
                    </label>
                  );
                })
              ) : (
                <p className="px-3 py-8 text-center text-sm text-slate-400">暂无整理建议</p>
              )}
            </div>
          </section>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
