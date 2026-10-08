import { useRef, useState } from "react";
import { AlertCircle, ArrowUp, BookOpenText, Check, CircleHelp, LoaderCircle, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { useAnalyzeNotebookWithAi } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { AiProfile, AiProviderId } from "@/lib/ai-settings";

type NotebookAssistantProps = {
  notebookContext: string;
  providerId: AiProviderId;
  modelId: string;
  profile: AiProfile;
  providerApiKey: string;
  aiReady: boolean;
  allowOnlineAi: boolean;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
};

type RetryRequest = {
  displayQuestion: string;
  apiQuestion: string;
};

const SUMMARY_PROMPT =
  "Кратко перескажи этот ноутбук: объясни его цель, основные этапы и полученный результат. Не запускай код и опирайся только на содержимое ноутбука.";
const MAX_CONTEXT_LENGTH = 32_000;
const MAX_QUESTION_LENGTH = 12_000;

function composeQuestion(question: string, messages: Message[]) {
  const recentDialogue = messages
    .slice(-8)
    .map((message) => {
      const role = message.role === "user" ? "Пользователь" : "Ассистент";
      return `${role}: ${message.content.slice(0, 900)}`;
    })
    .join("\n");

  const currentQuestion = `Новый вопрос: ${question}`;
  if (!recentDialogue) return currentQuestion.slice(0, MAX_QUESTION_LENGTH);

  const historyHeading = "Предыдущий диалог:\n";
  const availableHistoryLength = Math.max(
    0,
    MAX_QUESTION_LENGTH - currentQuestion.length - historyHeading.length - 2,
  );
  return `${historyHeading}${recentDialogue.slice(-availableHistoryLength)}\n\n${currentQuestion}`;
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `Не удалось получить ответ. ${error.message}`;
  }
  return "Не удалось получить ответ. Проверьте выбранного провайдера и попробуйте ещё раз.";
}

export function NotebookAssistant({
  notebookContext,
  providerId,
  modelId,
  profile,
  providerApiKey,
  aiReady,
  allowOnlineAi,
}: NotebookAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryRequest, setRetryRequest] = useState<RetryRequest | null>(null);
  const [isPending, setIsPending] = useState(false);
  const nextMessageId = useRef(0);
  const form = useForm<{ question: string }>({ defaultValues: { question: "" } });
  const question = form.watch("question") ?? "";
  const analyzeWithAi = useAnalyzeNotebookWithAi({
    request: providerApiKey
      ? { headers: { "x-ai-provider-key": providerApiKey } }
      : undefined,
  });
  const canAsk = aiReady && allowOnlineAi && Boolean(modelId) && Boolean(notebookContext.trim()) && !isPending;

  const addMessage = (message: Omit<Message, "id">) => {
    const id = nextMessageId.current++;
    setMessages((current) => [...current, { ...message, id }]);
  };

  const requestAnswer = async (displayQuestion: string, apiQuestion: string, addUserMessage: boolean) => {
    if (!canAsk) return;
    setErrorMessage(null);
    setRetryRequest(null);
    if (addUserMessage) addMessage({ role: "user", content: displayQuestion });

    try {
      setIsPending(true);
      const result = await analyzeWithAi.mutateAsync({
        data: {
          providerId,
          modelId,
          profile,
          notebookContext: notebookContext.slice(0, MAX_CONTEXT_LENGTH),
          question: apiQuestion.slice(0, MAX_QUESTION_LENGTH),
        },
      });
      if (!result.answer.trim()) {
        throw new Error("Сервер не вернул текст ответа.");
      }
      addMessage({
        role: "assistant",
        content: result.answer,
        model: result.modelId,
      });
    } catch (error) {
      setErrorMessage(readableError(error));
      setRetryRequest({ displayQuestion, apiQuestion });
    } finally {
      setIsPending(false);
    }
  };

  const submitQuestion = form.handleSubmit(async ({ question: submittedQuestion }) => {
    const cleanedQuestion = submittedQuestion.trim();
    if (!cleanedQuestion || !canAsk) return;
    const apiQuestion = composeQuestion(cleanedQuestion, messages);
    form.reset({ question: "" });
    await requestAnswer(cleanedQuestion, apiQuestion, true);
  });

  const requestSummary = () => {
    if (!canAsk) return;
    void requestAnswer(
      "Кратко перескажи ноутбук: цель, основные этапы и результат.",
      composeQuestion(SUMMARY_PROMPT, messages),
      true,
    );
  };

  const retry = () => {
    if (!retryRequest || !canAsk) return;
    void requestAnswer(retryRequest.displayQuestion, retryRequest.apiQuestion, false);
  };

  return (
    <Card
      className="overflow-hidden rounded-xl border-slate-200 bg-[#fbfcfa] text-slate-800 shadow-sm"
      data-testid="card-notebook-assistant"
    >
      <div className="border-b border-slate-200/80 bg-[#f2f6f3] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dcebe3] text-[#27624c]">
              <BookOpenText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Помощник по ноутбуку</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe2d6] bg-[#e9f2ec] px-2 py-0.5 text-[11px] font-medium text-[#32634f]">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Только чтение
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">
                Разберитесь в назначении, параметрах и сохранённых результатах — без запуска ячеек.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={requestSummary}
            disabled={!canAsk}
            className="shrink-0 border-[#bfd2c6] bg-[#fbfcfa] text-[#285d47] hover:bg-[#eaf2ed]"
            data-testid="button-notebook-summary"
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            Кратко пересказать
          </Button>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {!aiReady && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
            data-testid="status-ai-provider-required"
          >
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              Для онлайн-ответа выберите модель и добавьте API-ключ выбранного провайдера в Secrets проекта.
            </p>
          </div>
        )}
        {aiReady && !allowOnlineAi && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
            data-testid="status-ai-consent-required"
          >
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p>Сначала разрешите онлайн-анализ в карточке «Спросить о ноутбуке» выше.</p>
          </div>
        )}

        <div
          className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-xs leading-5 text-slate-600"
          data-testid="notice-assistant-privacy"
        >
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#597967]" aria-hidden="true" />
          <p>
            При отправке вопроса текст ноутбука передаётся выбранному AI-провайдеру. Провайдер может хранить запросы по своим правилам.
            Кодовые ячейки не запускаются. Не отправляйте секретные данные.
          </p>
        </div>

        {messages.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-5 py-7 text-center"
            data-testid="empty-assistant-conversation"
          >
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#edf3ef] text-[#557461]">
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800">Начните с краткого обзора или задайте вопрос</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Например: «Что здесь обучается?» или «За что отвечают параметры?»
            </p>
          </div>
        ) : (
          <div
            className="max-h-[28rem] space-y-4 overflow-y-auto pr-1"
            aria-live="polite"
            aria-relevant="additions text"
            data-testid="list-assistant-conversation"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-assistant-${message.role}-${message.id}`}
              >
                {message.role === "assistant" && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e4eee8] text-[#35624d]">
                    <BookOpenText className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-[#e9f1ec] text-slate-800"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-6" data-testid={`text-message-content-${message.id}`}>
                    {message.content}
                  </p>
                  {message.role === "assistant" && message.model && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400" data-testid={`text-message-model-${message.id}`}>
                      Модель: {message.model}
                    </p>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </article>
            ))}
            {isPending && (
              <div
                className="flex items-center gap-3 pl-11 text-sm text-slate-500"
                role="status"
                data-testid="status-assistant-pending"
              >
                <LoaderCircle className="h-4 w-4 animate-spin text-[#557967]" aria-hidden="true" />
                Читаю ноутбук и подготавливаю ответ…
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3"
            role="alert"
            data-testid="alert-assistant-error"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 text-rose-900">{errorMessage}</p>
              {retryRequest && (
                <Button
                  type="button"
                  variant="link"
                  onClick={retry}
                  disabled={!canAsk}
                  className="mt-1 h-auto min-h-0 px-0 py-1 text-xs text-rose-800"
                  data-testid="button-retry-assistant"
                >
                  Повторить запрос
                </Button>
              )}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={submitQuestion} className="space-y-2" data-testid="form-assistant-question">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="notebook-assistant-question" className="text-sm font-medium text-slate-800">
                    Ваш вопрос
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Textarea
                        {...field}
                        id="notebook-assistant-question"
                        placeholder="Спросите о назначении ноутбука, коде, параметрах или результатах…"
                        className="min-h-[96px] resize-y border-slate-300 bg-white pr-12 text-sm leading-6 placeholder:text-slate-400 focus-visible:ring-[#6c907a]"
                        maxLength={2_000}
                        disabled={!aiReady || !allowOnlineAi || isPending}
                        aria-describedby="assistant-input-help"
                        data-testid="input-assistant-question"
                      />
                    </FormControl>
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Отправить вопрос"
                      disabled={!canAsk || !question.trim()}
                      className="absolute bottom-3 right-3 h-8 w-8 rounded-lg bg-[#35654d] text-white hover:bg-[#28563f]"
                      data-testid="button-submit-assistant-question"
                    >
                      {isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </FormItem>
              )}
            />
            <p id="assistant-input-help" className="text-xs text-slate-500" data-testid="text-assistant-input-help">
              Ответы основаны на содержимом ноутбука и сохранённых выводах. Не отправляйте секретные данные.
            </p>
          </form>
        </Form>
      </div>
    </Card>
  );
}

export default NotebookAssistant;
