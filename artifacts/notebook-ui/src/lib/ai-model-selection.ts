export type AiModelChoiceGroup<T> = {
  id: string;
  label: string | null;
  models: T[];
};

export const AI_TUNNEL_MODEL_GROUPS = [
  {
    id: "fast",
    label: "Быстрые и недорогие",
    modelIds: [
      "qwen/qwen3.8-flash",
      "deepseek/deepseek-v4-flash",
      "anthropic/claude-haiku-5.5",
      "z-ai/glm-5.3-flash",
      "google/gemini-3.8-flash",
    ],
  },
  {
    id: "coding",
    label: "Сильные для кодинга",
    modelIds: [
      "openai/gpt-6.1-sol",
      "anthropic/claude-opus-5.5",
      "deepseek/deepseek-v4-pro",
    ],
  },
] as const;

export function getAiModelGroups<T extends { id: string }>(
  providerId: string,
  models: readonly T[],
): AiModelChoiceGroup<T>[] {
  if (providerId !== "aitunnel") {
    return models.length ? [{ id: "provider", label: null, models: [...models] }] : [];
  }

  const modelsById = new Map(models.map((model) => [model.id, model]));
  return AI_TUNNEL_MODEL_GROUPS.flatMap((group) => {
    const groupModels = group.modelIds.flatMap((modelId) => {
      const model = modelsById.get(modelId);
      return model ? [model] : [];
    });
    return groupModels.length
      ? [{ id: group.id, label: group.label, models: groupModels }]
      : [];
  });
}

export function getSelectableAiModels<T extends { id: string }>(
  providerId: string,
  models: readonly T[],
): T[] {
  return getAiModelGroups(providerId, models).flatMap((group) => group.models);
}

export function getDefaultAiModelId<T extends { id: string }>(
  providerId: string,
  models: readonly T[],
  profile: "review" | "economy",
): string {
  const groups = getAiModelGroups(providerId, models);
  const preferredGroupId = providerId === "aitunnel"
    ? profile === "review" ? "coding" : "fast"
    : "provider";
  return groups.find((group) => group.id === preferredGroupId)?.models[0]?.id
    ?? groups.flatMap((group) => group.models)[0]?.id
    ?? "";
}
