# Colab Help

Веб-приложение для работы с Jupyter-блокнотами `.ipynb`: загрузка и просмотр ячеек, ИИ-пояснения и интеграция с Google Colab для выполнения Python-кода.

## Компоненты

- `artifacts/notebook-ui` — веб-интерфейс блокнота.
- `artifacts/api-server` — API приложения.
- `artifacts/colab-bridge` — связь с Google Colab.

## Запуск

Нужен Node.js и pnpm.

```sh
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/notebook-ui run dev
```

Команды сервера и интерфейса запускаются в отдельных терминалах.
