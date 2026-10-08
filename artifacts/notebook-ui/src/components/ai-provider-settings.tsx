import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Settings2 } from "lucide-react";
import type { AiModel, AiProvider } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
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
  sessionKeyActive: boolean;
  onApplyApiKey: (apiKey: string) => Promise<void>;
  onClearApiKey: () => Promise<void>;
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
  sessionKeyActive,
  onApplyApiKey,
  onClearApiKey,
  onChange,
}: AiProviderSettingsProps) {
  const [filter, setFilter] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [connectionPending, setConnectionPending] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const provider = providers.find((item) => item.id === settings.providerId);
  useEffect(() => setApiKeyDraft(""), [settings.providerId]);
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
  const applyApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = apiKeyDraft.trim();
    if (!apiKey) return;
    setApiKeyDraft("");
    setConnectionError("");
    setConnectionPending(true);
    try {
      await onApplyApiKey(apiKey);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Не удалось проверить ключ.");
    } finally {
      setConnectionPending(false);
    }
  };

  const clearApiKey = async () => {
    setConnectionError("");
    setConnectionPending(true);
    try {
      await onClearApiKey();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Не удалось удалить ключ.");
    } finally {
      setConnectionPending(false);
    }
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
                  {item.name}
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
      <form
        onSubmit={applyApiKey}
        className="mt-4 rounded-md border bg-muted/20 p-3"
        data-testid="form-ai-provider-session-key"
      >
        <label htmlFor="input-ai-provider-key" className="mb-1.5 block text-xs font-medium">
          API-ключ {provider?.name ?? "провайдера"} для текущего сеанса
        </label>
        <Input
          id="input-ai-provider-key"
          type="password"
          value={apiKeyDraft}
          onChange={(event) => setApiKeyDraft(event.target.value)}
          placeholder={sessionKeyActive ? "Ключ активен; введите новый для замены" : "Вставьте ключ провайдера"}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={4096}
          aria-label="API-ключ провайдера на текущий сеанс"
          data-testid="input-ai-provider-key"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!apiKeyDraft.trim() || connectionPending} data-testid="button-use-ai-provider-key">
            {connectionPending ? "Проверяю ключ…" : sessionKeyActive ? "Заменить ключ" : "Подключить ключ"}
          </Button>
          {sessionKeyActive && (
            <Button type="button" variant="outline" size="sm" onClick={() => void clearApiKey()} disabled={connectionPending} data-testid="button-clear-ai-provider-key">
              Удалить ключ из сеанса
            </Button>
          )}
        </div>
        {connectionError && <p className="mt-2 text-xs text-destructive" role="alert" data-testid="text-ai-key-error">{connectionError}</p>}
        {sessionKeyActive ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground" role="status" data-testid="text-ai-session-key-active">
            Ключ проверен и хранится только в памяти сервера для этого браузерного сеанса — до 12 часов. Он не попадает в браузерное хранилище или базу данных; после перезапуска сервера сеанс сбрасывается.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Ключ отправляется серверу только для проверки доступа к моделям. После проверки он хранится в памяти сервера до 12 часов и не записывается в браузер, базу данных или журналы.
          </p>
        )}
      </form>
      {provider && (provider.voiceInputAvailable || provider.voiceOutputAvailable) && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid="text-ai-voice-models">
          Голосовой ввод: {provider.voiceInputAvailable ? provider.transcriptionModelId : "не настроен"} ·
          озвучивание: {provider.voiceOutputAvailable ? provider.speechModelId : "не настроено"}.
          Доступность конкретной модели зависит от ключа и проверяется при первом запросе.
        </p>
      )}
      <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground" aria-live="polite">
        {provider?.catalogRequiresKey && !sessionKeyActive && (
          <p data-testid="text-ai-provider-key-missing">
            Чтобы загрузить каталог моделей {provider.name}, введите ключ для этого сеанса. Для AI-запроса ключ понадобится у любого провайдера.
          </p>
        )}
        {modelsLoading && <p>Загружаю актуальный список моделей выбранного провайдера…</p>}
        {catalogError && (
          <p className="text-destructive" role="status" data-testid="text-ai-model-catalog-error">
            Не удалось загрузить каталог. Проверьте временный ключ и доступность API провайдера.
          </p>
        )}
        {!modelsLoading && !catalogError && models.length === 0 && !(provider?.catalogRequiresKey && !sessionKeyActive) && (
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
