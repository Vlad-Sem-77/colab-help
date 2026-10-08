import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import type { AiModel, AiProvider } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiSettings, AiProfile } from "@/lib/ai-settings";

interface AiProviderSettingsProps {
  settings: AiSettings;
  providers: AiProvider[];
  models: AiModel[];
  providersLoading: boolean;
  modelsLoading: boolean;
  catalogError: boolean;
  onChange: (settings: AiSettings) => void;
}

function formatModelPrice(model: AiModel): string {
  const hasPrice = model.inputPricePerMillion != null || model.outputPricePerMillion != null;
  if (!hasPrice) return "цена не указана";
  const currency = model.currency === "RUB" ? "₽" : model.currency === "USD" ? "$" : model.currency ?? "";
  const price = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
  return `вход ${price(model.inputPricePerMillion)} / выход ${price(model.outputPricePerMillion)} за 1 млн токенов`;
}

export function AiProviderSettings({
  settings,
  providers,
  models,
  providersLoading,
  modelsLoading,
  catalogError,
  onChange,
}: AiProviderSettingsProps) {
  const [filter, setFilter] = useState("");
  const provider = providers.find((item) => item.id === settings.providerId);
  const filteredModels = useMemo(() => {
    const normalizedFilter = filter.trim().toLocaleLowerCase();
    if (!normalizedFilter) return models;
    return models.filter((model) =>
      `${model.id} ${model.name} ${model.ownedBy ?? ""}`.toLocaleLowerCase().includes(normalizedFilter),
    );
  }, [filter, models]);

  const updateSettings = (patch: Partial<AiSettings>) => onChange({ ...settings, ...patch });
  const updateModel = (profile: AiProfile, modelId: string) => {
    updateSettings(profile === "review" ? { reviewModelId: modelId } : { economyModelId: modelId });
  };

  const renderModelSelect = (profile: AiProfile, value: string, label: string) => (
    <label className="space-y-1.5 text-xs font-medium">
      <span>{label}</span>
      <Select value={value || undefined} onValueChange={(modelId) => updateModel(profile, modelId)}>
        <SelectTrigger aria-label={label} data-testid={`select-ai-model-${profile}`}>
          <SelectValue placeholder={modelsLoading ? "Загрузка каталога…" : "Выберите модель из каталога"} />
        </SelectTrigger>
        <SelectContent>
          {filteredModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <span className="font-mono text-xs">{model.id}</span>
              <span className="ml-2 text-muted-foreground">{formatModelPrice(model)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <section className="rounded-lg border bg-card p-4" data-testid="panel-ai-provider-settings">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">ИИ-провайдер и модели</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium">
          <span>Провайдер</span>
          <Select
            value={settings.providerId}
            onValueChange={(providerId: AiSettings["providerId"]) => onChange({
              ...settings,
              providerId,
              reviewModelId: "",
              economyModelId: "",
            })}
          >
            <SelectTrigger aria-label="Провайдер ИИ" data-testid="select-ai-provider">
              <SelectValue placeholder={providersLoading ? "Загрузка…" : "Выберите провайдера"} />
            </SelectTrigger>
            <SelectContent>
              {providers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}{item.configured ? "" : " — нужен API-ключ"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>Профиль для следующего вопроса</span>
          <Select
            value={settings.profile}
            onValueChange={(profile: AiProfile) => updateSettings({ profile })}
          >
            <SelectTrigger aria-label="Профиль модели" data-testid="select-ai-profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review">Тщательная проверка</SelectItem>
              <SelectItem value="economy">Экономия и помощь с кодом</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {renderModelSelect("review", settings.reviewModelId, "Модель для проверки")}
        {renderModelSelect("economy", settings.economyModelId, "Модель для экономии и кода")}
      </div>
      <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground" aria-live="polite">
        {provider && !provider.configured && (
          <p data-testid="text-ai-provider-key-missing">
            Для отправки вопросов добавьте {provider.id === "aitunnel" ? "AI_TUNNEL_API_KEY" : provider.id === "proxyapi" ? "PROXYAPI_API_KEY" : provider.id === "routerai" ? "ROUTERAI_API_KEY" : "OPENAI_API_KEY"} в Secrets проекта. Каталог может быть доступен и без ключа.
          </p>
        )}
        {modelsLoading && <p>Загружаю актуальный список моделей выбранного провайдера…</p>}
        {catalogError && (
          <p className="text-destructive" role="status" data-testid="text-ai-model-catalog-error">
            Не удалось загрузить каталог. Для ProxyAPI и OpenAI нужен ключ провайдера в Secrets проекта.
          </p>
        )}
        {!modelsLoading && !catalogError && models.length === 0 && (
          <p>Каталог пока не содержит доступных текстовых моделей.</p>
        )}
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Найти модель по имени или ID"
          aria-label="Поиск модели"
          data-testid="input-ai-model-filter"
          className="mt-2 max-w-sm text-xs"
        />
        <p>
          Выберите реальные ID из каталога отдельно для двух задач. Цена отображается, только если её возвращает провайдер; названия моделей не ранжируются автоматически.
        </p>
      </div>
    </section>
  );
}
