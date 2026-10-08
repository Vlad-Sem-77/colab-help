import { useMemo, useState } from "react";
import { BookOpen, MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface NotebookReaderProps {
  notebook: Notebook;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const suggestedQuestions = [
  "Какова структура ноутбука?",
  "Какие библиотеки он использует?",
  "Что происходит в ячейке 1?",
];

export function NotebookReader({ notebook }: NotebookReaderProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const analysis = useMemo(() => analyzeNotebook(notebook), [notebook]);

  const ask = (rawQuestion: string) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion) return;
    const answer = answerNotebookQuestion(notebook, trimmedQuestion);
    setMessages(current => [
      ...current,
      { role: "user", text: trimmedQuestion },
      { role: "assistant", text: answer.text },
    ]);
    setQuestion("");
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
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Помощник по ноутбуку">
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
                    {section}
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
            Ответы содержат найденные фрагменты ячеек и сохранённые результаты
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3"
            aria-live="polite"
            data-testid="list-notebook-answers"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Задайте вопрос о переменной, библиотеке, разделе или номере ячейки.
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
              </div>
            ))}
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
                  ask(question);
                }
              }}
              placeholder="Например: где загружаются данные?"
              className="min-h-11 resize-y"
              aria-label="Вопрос о ноутбуке"
              data-testid="input-notebook-question"
            />
            <Button
              type="button"
              onClick={() => ask(question)}
              disabled={!question.trim()}
              aria-label="Отправить вопрос"
              data-testid="button-send-notebook-question"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter — отправить, Shift+Enter — новая строка. Если совпадений нет, помощник сообщит об этом, а не станет угадывать.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
