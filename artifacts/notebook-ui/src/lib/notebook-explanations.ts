import type { Notebook, NotebookCell } from "./notebook.ts";

export interface ImportedLibraryExplanation {
  name: string;
  purpose: string;
  notebookUse: string;
}

interface LibraryGuide {
  name: string;
  purpose: string;
}

interface ParsedImport {
  guideKey: string;
  moduleName: string;
  aliases: string[];
}

const LIBRARY_GUIDES: Record<string, LibraryGuide> = {
  pandas: {
    name: "pandas",
    purpose: "Работает с табличными данными: чтением, фильтрацией, объединением и сводным анализом таблиц.",
  },
  numpy: {
    name: "NumPy",
    purpose: "Предоставляет быстрые числовые массивы и математические операции над ними.",
  },
  matplotlib: {
    name: "Matplotlib",
    purpose: "Строит графики и диаграммы из числовых данных.",
  },
  seaborn: {
    name: "Seaborn",
    purpose: "Строит статистические графики и помогает сравнивать распределения данных.",
  },
  plotly: {
    name: "Plotly",
    purpose: "Создаёт интерактивные графики и диаграммы.",
  },
  sklearn: {
    name: "scikit-learn",
    purpose: "Содержит алгоритмы машинного обучения, подготовку данных и метрики качества моделей.",
  },
  torch: {
    name: "PyTorch",
    purpose: "Создаёт и обучает нейросети с помощью тензоров и операций автоматического дифференцирования.",
  },
  tensorflow: {
    name: "TensorFlow",
    purpose: "Создаёт и обучает модели машинного обучения, в том числе нейросети.",
  },
  keras: {
    name: "Keras",
    purpose: "Упрощает создание и обучение нейросетей из готовых слоёв.",
  },
  transformers: {
    name: "Transformers",
    purpose: "Загружает и использует предварительно обученные языковые и другие трансформерные модели.",
  },
  cv2: {
    name: "OpenCV",
    purpose: "Обрабатывает изображения и видео: загружает их, преобразует и извлекает визуальные признаки.",
  },
  pil: {
    name: "Pillow",
    purpose: "Открывает, преобразует и сохраняет изображения.",
  },
  requests: {
    name: "Requests",
    purpose: "Отправляет HTTP-запросы к сайтам и веб-API и получает от них данные.",
  },
  bs4: {
    name: "Beautiful Soup",
    purpose: "Разбирает HTML-страницы и извлекает из них текст и элементы.",
  },
  scipy: {
    name: "SciPy",
    purpose: "Предоставляет научные вычисления, статистические методы и алгоритмы оптимизации.",
  },
  statsmodels: {
    name: "statsmodels",
    purpose: "Строит статистические модели и выводит подробные статистические оценки.",
  },
  openpyxl: {
    name: "openpyxl",
    purpose: "Читает и изменяет файлы электронных таблиц Excel формата .xlsx.",
  },
  "google.colab": {
    name: "Google Colab",
    purpose: "Предоставляет функции среды Colab, например подключение Google Диска и обмен файлами.",
  },
  gdown: {
    name: "gdown",
    purpose: "Скачивает файлы, доступные по ссылкам Google Drive.",
  },
  yfinance: {
    name: "yfinance",
    purpose: "Загружает исторические и текущие биржевые данные из Yahoo Finance.",
  },
  polars: {
    name: "Polars",
    purpose: "Обрабатывает табличные данные с помощью быстрых DataFrame-операций.",
  },
  pyspark: {
    name: "PySpark",
    purpose: "Обрабатывает большие распределённые наборы данных через Apache Spark.",
  },
  sqlalchemy: {
    name: "SQLAlchemy",
    purpose: "Подключается к базам данных и выполняет SQL-запросы через Python-интерфейс.",
  },
  sqlite3: {
    name: "sqlite3",
    purpose: "Работает с локальными базами данных SQLite и SQL-запросами.",
  },
  csv: {
    name: "csv",
    purpose: "Читает и записывает строки в стандартном табличном формате CSV.",
  },
  json: {
    name: "json",
    purpose: "Преобразует данные между Python-объектами и форматом JSON.",
  },
  pathlib: {
    name: "pathlib",
    purpose: "Создаёт и разбирает пути к файлам и папкам.",
  },
  os: {
    name: "os",
    purpose: "Взаимодействует с операционной системой, файлами и переменными среды.",
  },
  re: {
    name: "re",
    purpose: "Ищет и изменяет текст по шаблонам регулярных выражений.",
  },
  math: {
    name: "math",
    purpose: "Выполняет базовые математические операции и вычисления.",
  },
  random: {
    name: "random",
    purpose: "Генерирует случайные числа и выбирает случайные элементы.",
  },
  datetime: {
    name: "datetime",
    purpose: "Создаёт и обрабатывает даты, время и временные интервалы.",
  },
  collections: {
    name: "collections",
    purpose: "Предоставляет специальные контейнеры данных, например счётчики и очереди.",
  },
  statistics: {
    name: "statistics",
    purpose: "Вычисляет базовые статистические показатели для наборов чисел.",
  },
};

const STANDARD_LIBRARY = new Set([
  "csv", "json", "pathlib", "os", "re", "math", "random", "datetime",
  "collections", "statistics", "sqlite3",
]);

function sourceOf(cell: NotebookCell): string {
  return cell.source.join("");
}

function stripPythonCommentsAndImports(source: string): string {
  return source
    .split(/\r?\n/)
    .filter(line => !/^\s*#/.test(line))
    .filter(line => !/^\s*(?:import\s+|from\s+\S+\s+import\s+)/.test(line))
    .map(line => line.replace(/\s+#.*$/, ""))
    .join("\n");
}

function guideKeyFor(moduleName: string): string {
  const normalized = moduleName.toLocaleLowerCase();
  if (normalized.startsWith("google.colab")) return "google.colab";
  if (normalized === "pil" || normalized.startsWith("pil.")) return "pil";
  if (normalized === "sklearn" || normalized.startsWith("sklearn.")) return "sklearn";
  if (normalized === "bs4" || normalized.startsWith("bs4.")) return "bs4";
  if (normalized === "cv2" || normalized.startsWith("cv2.")) return "cv2";

  const root = normalized.split(".")[0];
  return root;
}

function parseImports(source: string): ParsedImport[] {
  const imports: ParsedImport[] = [];

  for (const line of source.split(/\r?\n/)) {
    const fromImport = line.match(/^\s*from\s+([\w.]+)\s+import\s+(.+?)\s*$/);
    if (fromImport) {
      const moduleName = fromImport[1];
      const importedNames = fromImport[2]
        .replace(/^\s*\(/, "")
        .replace(/\)\s*$/, "")
        .split(",");
      const aliases = importedNames
        .map(item => item.trim().match(/^([\w*]+)(?:\s+as\s+(\w+))?$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map(match => match[2] || match[1])
        .filter(alias => alias !== "*");
      imports.push({
        guideKey: guideKeyFor(moduleName),
        moduleName,
        aliases,
      });
      continue;
    }

    const importStatement = line.match(/^\s*import\s+(.+?)\s*$/);
    if (!importStatement) continue;

    for (const item of importStatement[1].split(",")) {
      const match = item.trim().match(/^([\w.]+)(?:\s+as\s+(\w+))?$/);
      if (!match) continue;
      const moduleName = match[1];
      imports.push({
        guideKey: guideKeyFor(moduleName),
        moduleName,
        aliases: [match[2] || moduleName.split(".")[0]],
      });
    }
  }

  return imports;
}

function hasAliasUse(source: string, aliases: string[]): boolean {
  return aliases.some(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(source);
  });
}

function notebookUseForLibrary(
  key: string,
  source: string,
  used: boolean,
): string {
  if (key === "pandas") {
    const loadsTable = /\b(read_csv|read_excel|read_json|read_parquet)\s*\(/i.test(source);
    const transformsTable = /\b(groupby|pivot_table|merge|concat|dropna|fillna)\s*\(/i.test(source);
    if (loadsTable && transformsTable) {
      return "загрузки исходной таблицы и её последующей очистки, группировки или объединения перед анализом";
    }
    if (loadsTable) {
      return "загрузки исходных файлов с табличными данными";
    }
    if (/\b(groupby|pivot_table|merge|concat|dropna|fillna)\s*\(/i.test(source)) {
      return "очистки, объединения или группировки таблиц перед анализом";
    }
    if (/\b(describe|value_counts|mean|median|sum)\s*\(/i.test(source)) {
      return "расчёта сводных показателей по таблицам";
    }
    if (used) return "создания и преобразования таблиц для дальнейших вычислений";
  }

  if (key === "numpy") {
    if (/\b(random|rand|randn|normal|choice)\s*\(/i.test(source)) {
      return "создания числовых данных или случайных выборок для расчётов";
    }
    if (/\b(array|asarray|reshape|dot|mean|std|argmax)\s*\(/i.test(source)) {
      return "представления данных в числовых массивах и выполнения расчётов";
    }
    if (used) return "числовых операций, используемых в последующих вычислениях";
  }

  if (key === "matplotlib" || key === "seaborn" || key === "plotly") {
    if (/\b(show|savefig|plot|scatter|bar|hist|heatmap|line)\s*\(/i.test(source)) {
      return "построения или сохранения графиков по результатам анализа";
    }
    if (used) return "визуализации данных или результатов вычислений";
  }

  if (key === "sklearn") {
    if (/\b(fit|fit_transform|predict|predict_proba)\s*\(/i.test(source)) {
      return "обучения модели и получения прогнозов на подготовленных данных";
    }
    if (/\b(train_test_split|accuracy_score|classification_report|mean_squared_error|StandardScaler)\b/i.test(source)) {
      return "разделения данных, подготовки признаков или оценки качества модели";
    }
    if (used) return "подготовки данных или машинного обучения в этом ноутбуке";
  }

  if (key === "torch" || key === "tensorflow" || key === "keras") {
    if (/\b(fit|backward|optimizer|GradientTape|train_step)\s*\(?/i.test(source)) {
      return "обучения нейросетевой модели на данных ноутбука";
    }
    if (used) return "создания тензоров или компонентов нейросетевой модели";
  }

  if (key === "requests" && used) {
    return "получения данных с сайта или веб-API";
  }
  if (key === "bs4" && used) {
    return "извлечения нужной информации из HTML-страниц";
  }
  if ((key === "cv2" || key === "pil") && used) {
    return "загрузки или преобразования изображений";
  }
  if (key === "google.colab") {
    if (/\bdrive\.mount\s*\(/.test(source)) {
      return "подключения Google Диска, чтобы ноутбук мог читать или сохранять файлы";
    }
    if (/\b(files\.upload|files\.download)\s*\(/.test(source)) {
      return "загрузки файлов в среду Colab или скачивания результатов";
    }
    if (used) return "взаимодействия с функциями среды Google Colab";
  }
  if (key === "pathlib" && used) {
    return "формирования путей к входным файлам и результатам";
  }
  if (key === "json" && used) {
    return "чтения или сохранения структурированных данных в JSON";
  }
  if (key === "re" && used) {
    return "поиска или преобразования текста по шаблонам";
  }
  if (key === "os" && used) {
    return "работы с файлами, папками или настройками среды";
  }
  if (key === "openpyxl" && used) {
    return "чтения или создания Excel-файлов";
  }
  if (key === "gdown" && used) {
    return "скачивания входных файлов по ссылкам Google Drive";
  }
  if (used) {
    return "задачи, для которой она вызывается в коде этого ноутбука";
  }
  return "явных обращений к ней в коде ноутбука не найдено; возможно, импорт подготовлен для следующих ячеек";
}

export function explainImportedLibraries(
  cell: NotebookCell,
  notebook?: Notebook,
): ImportedLibraryExplanation[] {
  const imports = parseImports(sourceOf(cell));
  if (imports.length === 0) return [];

  const codeForNotebook = (notebook?.cells ?? [cell])
    .filter(item => item.type === "code" || item.type === "parameter")
    .map(item => stripPythonCommentsAndImports(sourceOf(item)))
    .join("\n");
  const grouped = new Map<string, ParsedImport>();

  for (const item of imports) {
    const previous = grouped.get(item.guideKey);
    grouped.set(item.guideKey, {
      ...item,
      aliases: [...new Set([...(previous?.aliases ?? []), ...item.aliases])],
    });
  }

  return [...grouped.entries()].map(([key, item]) => {
    const guide = LIBRARY_GUIDES[key];
    const used = hasAliasUse(codeForNotebook, item.aliases);
    const isStandard = STANDARD_LIBRARY.has(key);
    const name = guide?.name ?? item.moduleName;
    const purpose = guide?.purpose
      ?? (isStandard
        ? `Стандартный модуль Python для работы с ${item.moduleName}.`
        : `Библиотека «${item.moduleName}» добавляет в Python дополнительные функции; точную область лучше определять по её вызовам в коде.`);

    return {
      name,
      purpose,
      notebookUse: notebookUseForLibrary(key, codeForNotebook, used),
    };
  });
}

function markdownText(source: string): string {
  return source
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function explainMarkdownCell(source: string): string {
  const meaning = markdownText(source).toLocaleLowerCase();
  if (/(goal|objective|цель|задач|ожидаем|purpose)/i.test(meaning)) {
    return "Формулирует цель раздела и помогает понять, какого результата должны достичь последующие шаги.";
  }
  if (/(install|pip|установ|зависимост|настро|setup|environment|сред)/i.test(meaning)) {
    return "Объясняет, какие инструменты или настройки нужны перед работой с кодом; сама текстовая ячейка ничего не устанавливает.";
  }
  if (/(load|read|input|dataset|csv|excel|source|data|clean|prepare|данн|файл|подготов|источник)/i.test(meaning)) {
    return "Объясняет источник или подготовку входных данных и зачем они нужны для последующего анализа.";
  }
  if (/(result|output|conclusion|вывод|результат|итог|заключен)/i.test(meaning)) {
    return "Помогает интерпретировать результаты предыдущих вычислений; сама ячейка ничего не пересчитывает.";
  }
  if (/(model|train|обуч|модел|predict|прогноз)/i.test(meaning)) {
    return "Объясняет этап работы с моделью и связывает его с кодом в соседних ячейках.";
  }
  if (/^\s*#{1,6}\s/m.test(source)) {
    return "Обозначает тему раздела и помогает понять, к какому этапу относится следующий код.";
  }
  return "Даёт контекст для соседних ячеек и объясняет ход работы; вычисления здесь не выполняются.";
}

function explainCommentIntent(source: string): string | null {
  const comments = source.match(/^\s*#\s*(.+)$/gm)?.join(" ").toLocaleLowerCase() ?? "";
  if (!comments) return null;
  if (/(install|setup|environment|установ|зависимост|настро)/i.test(comments)) {
    return "Комментарий отмечает подготовку среды или библиотек; сам комментарий ничего не устанавливает.";
  }
  if (/(load|read|data|dataset|file|данн|файл|загруз|прочит)/i.test(comments)) {
    return "Комментарий отмечает этап получения или подготовки входных данных.";
  }
  if (/(train|fit|model|обуч|модел)/i.test(comments)) {
    return "Комментарий обозначает шаг обучения или применения модели.";
  }
  if (/(plot|chart|visual|граф|диаграм|визуал)/i.test(comments)) {
    return "Комментарий обозначает этап визуализации данных или результатов.";
  }
  return "Комментарий поясняет замысел автора, но по одному комментарию нельзя подтвердить, что делает код.";
}

export function getNotebookCellActions(source: string): string[] {
  const code = stripPythonCommentsAndImports(source);
  const actions: string[] = [];

  if (/\bdrive\.mount\s*\(/.test(code)) {
    actions.push("подключает файлы из Google Диска к среде Colab");
  }
  if (/\b(read_csv|read_excel|read_json|read_parquet)\s*\(/i.test(code)) {
    actions.push("загружает исходные данные из файла в таблицу");
  } else if (/\b(read_sql|load_dataset|open)\s*\(/i.test(code)) {
    actions.push("получает входные данные из базы, набора данных или файла");
  }
  if (/\b(dropna|fillna|astype|replace)\s*\(/i.test(code)) {
    actions.push("очищает или приводит данные к нужному формату");
  }
  if (/\b(groupby|pivot_table|merge|concat)\s*\(/i.test(code)) {
    actions.push("группирует или объединяет данные для анализа");
  }
  if (/\b(def|class)\s+\w+/m.test(code)) {
    actions.push("создаёт функцию или класс для повторного использования");
  }
  if (/\b(fit|fit_transform|backward|optimizer|Trainer)\s*\(?/i.test(code)) {
    actions.push("обучает или настраивает модель на данных");
  }
  if (/\b(predict|predict_proba)\s*\(/i.test(code)) {
    actions.push("получает прогноз модели");
  }
  if (/\b(accuracy_score|classification_report|mean_squared_error|r2_score)\s*\(/i.test(code)) {
    actions.push("измеряет качество прогноза модели");
  }
  if (/\b(plt\.|sns\.|plotly|\.plot\s*\(|\.scatter\s*\(|\.hist\s*\()/i.test(code)) {
    actions.push("визуализирует данные или результаты");
  }
  if (/\b(print|display)\s*\(/i.test(code)) {
    actions.push("показывает текст или вычисленные данные");
  }

  return [...new Set(actions)];
}

export function explainNotebookCell(
  cell: NotebookCell,
  index: number,
  notebook?: Notebook,
): string {
  const source = sourceOf(cell).trim();
  if (!source) return `Ячейка ${index + 1} пока пустая.`;
  if (cell.type === "markdown") return explainMarkdownCell(source);
  if (cell.type === "raw") {
    return "Содержит текст или данные формата Jupyter raw; приложение показывает их для чтения, но не считает исполняемым Python-кодом.";
  }

  const imports = explainImportedLibraries(cell, notebook);
  const actions = getNotebookCellActions(source);
  const params = cell.params?.map(param => param.varName) ?? [];
  if (cell.type === "parameter" && params.length > 0) {
    return `Позволяет менять настройки, от которых зависит дальнейший результат ноутбука: ${params.join(", ")}.`;
  }
  if (actions.length > 0) {
    return `Эта ячейка ${actions.join("; ")}.`;
  }
  if (imports.length > 0) {
    return "Подготавливает библиотеки для дальнейших шагов. Ниже объяснено, для чего нужна каждая и как она используется в этом ноутбуке.";
  }

  const commentMeaning = explainCommentIntent(source);
  if (commentMeaning && !stripPythonCommentsAndImports(source).trim()) return commentMeaning;

  return "Код этой ячейки показан для чтения. По его конструкции не удалось надёжно определить конкретную задачу, и приложение не запускает его.";
}
