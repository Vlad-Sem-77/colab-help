export type AiProviderId = "aitunnel" | "proxyapi" | "routerai" | "openai";
export type AiProfile = "review" | "economy";

export interface AiSettings {
  providerId: AiProviderId;
  profile: AiProfile;
  reviewModelId: string;
  economyModelId: string;
}

export const AI_SETTINGS_STORAGE_KEY = "notebook-ui-ai-settings-v1";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerId: "aitunnel",
  profile: "review",
  reviewModelId: "",
  economyModelId: "",
};

const providerIds: AiProviderId[] = ["aitunnel", "proxyapi", "routerai", "openai"];

export function readSavedAiSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const saved = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(saved) as Partial<AiSettings>;
    if (
      !parsed.providerId
      || !providerIds.includes(parsed.providerId)
      || (parsed.profile !== "review" && parsed.profile !== "economy")
    ) {
      return DEFAULT_AI_SETTINGS;
    }
    return {
      providerId: parsed.providerId,
      profile: parsed.profile,
      reviewModelId: typeof parsed.reviewModelId === "string" ? parsed.reviewModelId : "",
      economyModelId: typeof parsed.economyModelId === "string" ? parsed.economyModelId : "",
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Provider and model selections still work for the current visit.
  }
}

export function getActiveAiModelId(settings: AiSettings): string {
  return settings.profile === "review" ? settings.reviewModelId : settings.economyModelId;
}
