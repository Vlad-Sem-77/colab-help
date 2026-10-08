import { useMemo, useState } from "react";
import { BookOpen, MessageCircle, Send } from "lucide-react";
import { useAnalyzeNotebookWithAi } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeNotebook,
  answerNotebookQuestion,
  Notebook,
} from "@/lib/notebook";
import type { AiProfile, AiProviderId } from "@/lib/ai-settings";

interface NotebookReaderProps {
  notebook: Notebook;
  notebookContext: string;
  providerId: AiProviderId;
  modelId: string;
  profile: AiProfile;
  providerApiKey: string;
  aiReady: boolean;
  allowOnlineAi: boolean;
  onAllowOnlineAiChange: (allow: boolean) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: number[];
  answerMode?: "local" | "ai" | "fallback";
}

const suggestedQuestions = [
  "Какова структура ноутбука?",
  "Какие библиотеки он использует?",
  "Что происходит в ячейке 1?",
];

const MAX_QUESTION_LENGTH = 12_000;
const MAX_CONTEXT_LENGTH = 32_000;

function composeQuestion(question: string, messages: ChatMessage[]) {
  const previousMessages = messages
    .slice(-8)
    .map((message) => `${message.role === "user" ? "Пользователь" : "Ассистент"}: ${message.text.slice(0, 900)}`)
    .join("\n");
  const currentQuestion = `Новый вопрос: ${question}`;
  const conversation = previousMessages
    ? `Предыдущий диалог:\n${previousMessages}\n\n${currentQuestion}`
    : currentQuestion;
  return conversation.slice(-MAX_QUESTION_LENGTH);
}

export function NotebookReader({
  notebook,
  notebookContext,
  providerId,
  modelId,
  profile,
  providerApiKey,
  aiReady,
  allowOnlineAi,
  onAllowOnlineAiChange,
}: NotebookReaderProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const analyzeWithAi = useAnalyzeNotebookWithAi({
    request: providerApiKey
      ? { headers: { "x-ai-provider-key": providerApiKey } }
      : undefined,
  });
  const analysis = useMemo(() => analyzeNotebook(notebook), [notebook]);
  const sectionCellIndexes = useMemo(() => {
    const indexes: number[] = [];
    notebook.cells.forEach((cell, cellIndex) => {
      if (cell.type !== "markdown") return;
      for (const match of cell.source.join("").matchAll(/^\s{0,3}#{1,6}\s+(.+)$/gm)) {
        if (match[1].trim()) indexes.push(cellIndex);
      }
    });
    return indexes;
  }, [notebook]);
  const ask = async (rawQuestion: string) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion || isPending) return;

    const localAnswer = answerNotebookQuestion(notebook, trimmedQuestion);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: trimmedQuestion }]);

    if (!allowOnlineAi || !aiReady || !modelId) {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: localAnswer.text, sources: localAnswer.sources, answerMode: "local" },
      ]);
      return;
    }

    setIsPending(true);
    try {
      const result = await analyzeWithAi.mutateAsync({
        data: {
          providerId,
          modelId,
          profile,
          notebookContext: notebookContext.slice(0, MAX_CONTEXT_LENGTH),
          question: composeQuestion(trimmedQuestion, messages),
        },
      });
      const sources = result.sources.filter((source) => Number.isInteger(source) && source >= 0);
      if (sources.length === 0) {
        throw new Error("Ответ модели не содержит ссылок на ячейки.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer,
          sources,
          answerMode: "ai",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `AI сейчас недоступен; ответил локальный поиск.\n\n${localAnswer.text}`,
          sources: localAnswer.sources,
          answerMode: "fallback",
        },
      ]);
    } finally {
      setIsPending(false);
    }
  };

  const stats = [
    { label: "Всего", value: analysis.totalCells },
    { label: "Код", value: analysis.codeCells },
    { label: "Параметры", value: analysis.parameterCells },
    { label: "Текст", value: analysis.markdownCells },
    { label: "С результатом", value: analysis.outputCells },
    { label: "Запущено", value: analysis.executedCells },
  ];

  return (
    <section className="notebook-reader-panels grid gap-4 lg:grid-cols-2" aria-label="Помощник по ноутбуку">
      <Card data-testid="card-notebook-analysis">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" />
                Разбор ноутбука
              </CardTitle>
              <CardDescription className="mt-1">
                Структура, разделы и краткое резюме по загруженному файлу
              </CardDescription>
            </div>
            <Badge variant="secondary">Локальный анализ</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed" data-testid="text-notebook-summary">
            {analysis.summary || "В файле пока нет ячеек для разбора."}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map(stat => (
              <div
                key={stat.label}
                className="rounded-md border bg-muted/30 px-3 py-2"
                data-testid={`stat-notebook-${stat.label.toLowerCase().replaceAll(" ", "-")}`}
              >
                <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {analysis.language && (
            <div className="text-xs text-muted-foreground" data-testid="text-notebook-language">
              Ядро: <span className="font-medium text-foreground">{analysis.language}</span>
            </div>
          )}

          {analysis.sections.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Разделы</h3>
              <ol className="space-y-1 border-l pl-3 text-sm text-muted-foreground">
                {analysis.sections.map((section, index) => (
                  <li key={`${section}-${index}`} data-testid={`text-notebook-section-${index}`}>
                    {sectionCellIndexes[index] !== undefined ? (
                      <a
                        href={`#notebook-cell-${sectionCellIndexes[index]}`}
                        className="font-medium underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label={`Перейти к ячейке ${sectionCellIndexes[index] + 1}: ${section}`}
                        data-testid={`link-notebook-section-${index}`}
                      >
                        {section}
                      </a>
                    ) : (
                      <span
                        title="Ячейка с этим заголовком не найдена"
                        data-testid={`text-notebook-unlinked-section-${index}`}
                      >
                        {section} <span className="text-xs">(ячейка не найдена)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="border-t pt-3 text-xs text-muted-foreground">
            Анализ строится в браузере по заголовкам, коду, метаданным и сохранённым результатам. Внешняя AI-модель не используется.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-notebook-questions">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Спросить о ноутбуке
          </CardTitle>
          <CardDescription>
            Ответы учитывают код, текст и сохранённые результаты ячеек
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start gap-2.5 text-sm">
              <Checkbox
                id="notebook-ai-consent"
                checked={allowOnlineAi}
                onCheckedChange={(checked) => onAllowOnlineAiChange(checked === true)}
                disabled={!aiReady || isPending}
                aria-label="Разрешить отправку содержимого ноутбука выбранному AI-провайдеру"
                data-testid="checkbox-notebook-ai-consent"
              />
              <label htmlFor="notebook-ai-consent" className="cursor-pointer font-medium leading-5">
                Разрешить онлайн-анализ выбранной моделью
              </label>
            </div>
            <p className="mt-2 pl-6 text-xs leading-5 text-muted-foreground">
              {aiReady
                ? "При включении вопрос, код, текст и сохранённые результаты ячеек отправляются выбранному провайдеру. Условия хранения зависят от него. Код не запускается."
                : "Сначала введите API-ключ для текущего сеанса и выберите модель. До этого ответы строятся локально."}
            </p>
          </div>

          <div
            className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3"
            aria-live="polite"
            data-testid="list-notebook-answers"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Задайте вопрос о назначении ноутбука, его коде или полученных результатах.
              </p>
            ) : messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === "user" ? "ml-6 rounded-lg bg-primary/10 p-3" : "mr-3 rounded-lg bg-card p-3"}
                data-testid={`message-notebook-${message.role}-${index}`}
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {message.role === "user" ? "Вы" : "По содержимому ноутбука"}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
                {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground" data-testid={`text-notebook-sources-${index}`}>
                    Источники: ячейки {message.sources.map((source) => source + 1).join(", ")}
                    {message.answerMode === "ai" ? " · AI" : message.answerMode === "fallback" ? " · локальный ответ" : " · локальный поиск"}
                  </p>
                )}
              </div>
            ))}
            {isPending && (
              <p className="text-sm text-muted-foreground" role="status" data-testid="status-notebook-ai-pending">
                AI изучает ячейки и сохранённые результаты…
              </p>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map(suggestion => (
                <Button
                  key={suggestion}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto whitespace-normal py-1.5 text-left"
                  onClick={() => ask(suggestion)}
                  disabled={isPending}
                  data-testid={`button-suggested-question-${suggestion.slice(0, 12).replaceAll(" ", "-")}`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Textarea
              value={question}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(question);
                }
              }}
              placeholder="Например: где загружаются данные?"
              className="min-h-11 resize-y"
              disabled={isPending}
              aria-label="Вопрос о ноутбуке"
              data-testid="input-notebook-question"
            />
            <Button
              type="button"
              onClick={() => void ask(question)}
              disabled={!question.trim() || isPending}
              aria-label="Отправить вопрос"
              data-testid="button-send-notebook-question"
            >
              {isPending ? <span className="text-xs">…</span> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter — отправить, Shift+Enter — новая строка. Передача ноутбука в онлайн-ИИ возможна только после вашего разрешения.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
