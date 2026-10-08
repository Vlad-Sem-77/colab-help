export type AiCatalogProviderId = "aitunnel" | "proxyapi" | "routerai" | "openai";

export type AiCatalogModel = {
  id: string;
  name: string;
  description: string | null;
  ownedBy: string | null;
  contextLength: number | null;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  currency: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function readModelRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    if (payload.length === 1) {
      const first = asRecord(payload[0]);
      if (first && Array.isArray(first.data)) return first.data;
    }
    return payload;
  }
  const record = asRecord(payload);
  if (!record) return [];
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.models)) return record.models;
  if (Array.isArray(record.chat)) return record.chat;
  return [];
}

function isTextModel(record: Record<string, unknown>, id: string): boolean {
  const architecture = asRecord(record.architecture);
  const modalities = record.output_modalities ?? architecture?.output_modalities;
  if (Array.isArray(modalities) && !modalities.some((item) => item === "text")) return false;
  return !/(?:^|[\/._-])(embedding|embed|dall-e|whisper|moderation|tts|speech|transcription|sora|video|image)(?:$|[\/._-])/i.test(id);
}

function normalizeModel(providerId: AiCatalogProviderId, value: unknown): AiCatalogModel | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asString(record.id) ?? asString(record.name) ?? asString(record.slug);
  if (!id || !isTextModel(record, id)) return null;

  const pricing = asRecord(record.pricing);
  const priceUnits = asRecord(record.pricing_units);
  const rawInputPrice = asFiniteNumber(record.prompt_cost)
    ?? asFiniteNumber(record.input_price_per_million)
    ?? asFiniteNumber(pricing?.prompt)
    ?? asFiniteNumber(pricing?.input);
  const rawOutputPrice = asFiniteNumber(record.completion_cost)
    ?? asFiniteNumber(record.output_price_per_million)
    ?? asFiniteNumber(pricing?.completion)
    ?? asFiniteNumber(pricing?.output);
  const perTokenPricing = providerId === "routerai"
    && (priceUnits?.prompt === "token" || priceUnits?.completion === "token");
  const priceScale = perTokenPricing ? 1_000_000 : 1;
  const contextLength = asFiniteNumber(record.context_length) ?? asFiniteNumber(record.contextLength);

  return {
    id,
    name: asString(record.name) ?? id,
    description: asString(record.description),
    ownedBy: asString(record.owned_by) ?? asString(record.ownedBy),
    contextLength: contextLength === null ? null : Math.floor(contextLength),
    inputPricePerMillion: rawInputPrice === null ? null : rawInputPrice * priceScale,
    outputPricePerMillion: rawOutputPrice === null ? null : rawOutputPrice * priceScale,
    currency: rawInputPrice === null && rawOutputPrice === null
      ? null
      : providerId === "aitunnel" || providerId === "routerai"
        ? "RUB"
        : null,
  };
}

export function normalizeAiCatalog(providerId: AiCatalogProviderId, payload: unknown): AiCatalogModel[] {
  const seen = new Set<string>();
  return readModelRows(payload).flatMap((row) => {
    const model = normalizeModel(providerId, row);
    if (!model || seen.has(model.id)) return [];
    seen.add(model.id);
    return [model];
  });
}
