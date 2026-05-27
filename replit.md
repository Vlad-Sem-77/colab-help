# Replit ↔ Colab Bridge

Интерактивный пульт управления для экспериментов с бесплатными LLM через OpenRouter. Веб-интерфейс на Replit отправляет задания в Google Colab, который через OpenRouter вызывает бесплатные языковые модели (Llama, Gemma, Mistral и др.).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — запуск API сервера (порт 8080)
- `pnpm --filter @workspace/colab-bridge run dev` — запуск фронтенда (порт 19913)
- `pnpm run typecheck` — полная проверка типов
- `pnpm run build` — typecheck + сборка всех пакетов
- `pnpm --filter @workspace/api-spec run codegen` — регенерация API хуков и Zod схем
- `pnpm --filter @workspace/db run push` — применить изменения DB схемы (только dev)
- Required env: `DATABASE_URL` — строка подключения к PostgreSQL
- Required env: `OPENROUTER_API_KEY` — ключ OpenRouter API (используется в Colab)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TanStack Query + wouter + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — источник истины для всех API контрактов
- `lib/db/src/schema/history.ts` — схема таблицы истории экспериментов
- `artifacts/api-server/src/routes/colab.ts` — маршруты для взаимодействия с Colab
- `artifacts/api-server/src/routes/history.ts` — маршруты истории экспериментов
- `artifacts/colab-bridge/src/` — React фронтенд
- `colab_backend.ipynb` — Colab-ноутбук (Flask + ngrok бэкенд)

## Architecture decisions

- Replit хранит OpenRouter API ключ в секретах; Colab получает его от пользователя интерактивно через `getpass` — ключ не хранится в коде
- API сервер на Replit проксирует запросы к Colab (POST /api/colab/run), добавляя нормализацию ответов — фронтенд никогда не обращается к Colab напрямую
- История экспериментов хранится в PostgreSQL на стороне Replit и записывается при каждом успешном запросе к Colab
- Colab-бэкенд — stateless Flask сервер: не хранит данные, только выполняет запросы к OpenRouter

## Product

- Главная страница (Experiment Panel): подключение к Colab по ngrok URL, выбор режима модели (авто/ручной), настройка параметров, отправка задания, отображение карточки модели + метрик + ответа
- История (History Log): список всех прошлых экспериментов с возможностью удаления
- Генерация Python-кода для вставки в Colab-ноутбук
- Скачивание TXT-отчёта с результатами эксперимента

## Как запустить (инструкция)

### 1. Откройте Colab-ноутбук

Файл `colab_backend.ipynb` в корне проекта — скачайте и загрузите в Google Colab,
или откройте через File → Upload notebook.

### 2. Запустите все ячейки в Colab

`Runtime → Run all` — введите OpenRouter API ключ и (опционально) ngrok токен.

После запуска скопируйте ngrok URL из вывода последней ячейки:
```
>>> https://xxxx-xx-xxx-xxx-xx.ngrok-free.app <<<
```

### 3. Вставьте URL в интерфейс Replit

В поле CONNECTION вверху страницы вставьте URL и нажмите PING.
Статус должен стать ONLINE.

### 4. Запустите эксперимент

- Выберите тип задания (Text Generation, Model Comparison и др.)
- Режим модели: AUTO — OpenRouter сам выберет, MANUAL — выберите из списка
- Введите промпт, настройте параметры
- Нажмите INITIALIZE RUN

### 5. После получения результата

- Карточка модели показывает какая именно модель ответила
- Кнопка "Generate Colab Code" — готовый Python-код для вставки в ноутбук
- Кнопка "Download TXT" — скачать отчёт об эксперименте

## User preferences

- Интерфейс на React (не Streamlit) — более современный и быстрый

## Gotchas

- Colab-сессия живёт ~12 часов, ngrok без токена — ~2 часа. При обрыве — перезапустить ячейки и вставить новый URL
- При изменении OpenAPI спека — обязательно запустить codegen перед разработкой
- `pnpm run typecheck:libs` нужно запускать после изменения `lib/*` схем, иначе api-server не увидит новые экспорты

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
