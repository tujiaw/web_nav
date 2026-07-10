type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  disableThinking?: boolean;
  model: string;
  providerName: string;
};

type OrganizeLinkInput = {
  id: string;
  title: string;
  url: string;
  description?: string;
};

type OrganizeCategoryInput = {
  id: string;
  name: string;
  links: OrganizeLinkInput[];
};

type OrganizeTargetCategoryInput = {
  id: string;
  name: string;
};

export type AiOrganizeRequest = {
  config: LlmConfig;
  sourceCategories: OrganizeCategoryInput[];
  targetCategories: OrganizeTargetCategoryInput[];
};

export type AiOrganizeSuggestion = {
  linkId: string;
  reason: string;
  targetCategoryId: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function getChatCompletionsUrl(baseUrl: string) {
  const trimmed = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response is not valid JSON");
  }
  return value.slice(start, end + 1);
}

function getDisabledThinkingOptions(config: LlmConfig) {
  if (config.disableThinking === false) {
    return {};
  }

  const marker = `${config.providerName} ${config.baseUrl} ${config.model}`.toLowerCase();
  if (marker.includes("deepseek")) {
    return { thinking: { type: "disabled" } };
  }
  if (marker.includes("dashscope") || marker.includes("aliyun") || marker.includes("qwen") || marker.includes("siliconflow")) {
    return { enable_thinking: false };
  }
  if (marker.includes("openrouter")) {
    return { reasoning: { enabled: false } };
  }

  return {};
}

export async function organizeNavigationWithAi(request: AiOrganizeRequest): Promise<AiOrganizeSuggestion[]> {
  const config = request.config;
  if (!config.apiKey?.trim() || !config.model?.trim()) {
    throw new Error("Missing LLM config");
  }

  const validLinkIds = new Set(request.sourceCategories.flatMap((category) => category.links.map((link) => link.id)));
  const validCategoryIds = new Set(request.targetCategories.map((category) => category.id));

  const response = await fetch(getChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You reorganize bookmarks. Only reorganize links from sourceCategories. You may choose any category from targetCategories as targetCategoryId. Do not output chain-of-thought, reasoning, or thinking content. Return final JSON only: {\"items\":[{\"linkId\":\"...\",\"targetCategoryId\":\"...\",\"reason\":\"...\"}]}",
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceCategories: request.sourceCategories.map((category) => ({
              id: category.id,
              name: category.name,
              links: category.links.map((link) => ({
                id: link.id,
                title: link.title,
                url: link.url,
                description: link.description || "",
              })),
            })),
            targetCategories: request.targetCategories.map((category) => ({
              id: category.id,
              name: category.name,
            })),
          }),
        },
      ],
      temperature: 0.2,
      ...getDisabledThinkingOptions(config),
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonObject(content)) as {
    items?: Array<{
      linkId?: string;
      reason?: string;
      targetCategoryId?: string;
    }>;
  };

  return (parsed.items ?? [])
    .filter((item) => item.linkId && item.targetCategoryId)
    .filter((item) => validLinkIds.has(item.linkId!) && validCategoryIds.has(item.targetCategoryId!))
    .map((item) => ({
      linkId: item.linkId!,
      targetCategoryId: item.targetCategoryId!,
      reason: item.reason || "AI 建议调整分类",
    }));
}
