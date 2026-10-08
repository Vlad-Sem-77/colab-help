import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const notebookFixture = fileURLToPath(
  new URL("./fixtures/notebook-browser-scenario.ipynb", import.meta.url),
);

function notebookFile(name: string, content: string) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(content),
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/ai/providers", async route => {
    await route.fulfill({
      json: {
        providers: [
          { id: "aitunnel", name: "AI Tunnel", configured: true },
          { id: "proxyapi", name: "ProxyAPI", configured: true },
          { id: "routerai", name: "RouterAI", configured: true },
          { id: "openai", name: "OpenAI", configured: true },
        ],
      },
    });
  });
  await page.route("**/api/ai/models**", async route => {
    const providerId = new URL(route.request().url()).searchParams.get("providerId") ?? "aitunnel";
    await route.fulfill({
      json: {
        providerId,
        count: 2,
        models: [
          {
            id: "openai/gpt-6.1-sol",
            name: "openai/gpt-6.1-sol",
            inputPricePerMillion: 400,
            outputPricePerMillion: 2000,
            currency: "RUB",
          },
          {
            id: "qwen/qwen3.8-flash",
            name: "qwen/qwen3.8-flash",
            inputPricePerMillion: 30,
            outputPricePerMillion: 94,
            currency: "RUB",
          },
        ],
      },
    });
  });
  await page.route("**/api/ai/analyze-notebook", async route => {
    const request = route.request().postDataJSON() as { providerId: string; modelId: string };
    await route.fulfill({
      json: {
        answer: `Ответ ИИ по модели ${request.modelId}`,
        providerId: request.providerId,
        modelId: request.modelId,
        sources: [0],
      },
    });
  });
  await page.goto("/notebook/");
});

test("switches notebook styles and restores the selected style after reload", async ({ page }) => {
  const lightWavesButton = page.getByTestId("button-theme-light-waves");
  const windows95Button = page.getByTestId("button-theme-windows95");

  await expect(lightWavesButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-notebook-theme", "light-waves");

  await windows95Button.click();
  await expect(windows95Button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-notebook-theme", "windows95");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("notebook-ui-theme")))
    .toBe("windows95");

  await page.reload();
  await expect(windows95Button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-notebook-theme", "windows95");

  await lightWavesButton.click();
  await page.reload();
  await expect(lightWavesButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-notebook-theme", "light-waves");
});

test("uploads notebook text, parameters and saved results with the notebook helpers", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);

  await expect(page.getByText("Блокнот готов")).toBeVisible();
  await expect(page.locator('[data-notebook-cell-type="markdown"]'))
    .toContainText("Этот текст описывает подготовку данных.");
  await expect(page.locator('[data-notebook-cell-type="parameter"]')).toBeVisible();
  await expect(page.getByTestId("parameter-prompt"))
    .toHaveValue("Опиши результат анализа");
  await expect(page.getByTestId("parameter-temperature")).toBeVisible();
  await expect(page.getByTestId("text-cell-output-saved-result-0"))
    .toContainText("Сохранённый результат: 12 строк");

  await expect(page.getByTestId("card-notebook-questions")).toBeVisible();
  await expect(page.getByTestId("card-notebook-assistant")).toBeVisible();

  await page.getByTestId("input-notebook-question").fill("Что происходит в ячейке 1?");
  await page.getByTestId("button-send-notebook-question").click();
  await expect(page.getByTestId("message-notebook-assistant-1"))
    .toContainText("Этот текст описывает подготовку данных.");
});

test("assigns exact catalog models to review and economy profiles", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);

  await page.getByTestId("select-ai-model-review").click();
  await page.getByRole("option", { name: /openai\/gpt-6\.1-sol/ }).click();
  await page.getByTestId("select-ai-model-economy").click();
  await page.getByRole("option", { name: /qwen\/qwen3\.8-flash/ }).click();
  await page.getByTestId("select-ai-profile").click();
  await page.getByRole("option", { name: "Экономия и помощь с кодом" }).click();
  await expect.poll(() => page.evaluate(() => {
    const saved = localStorage.getItem("notebook-ui-ai-settings-v1");
    return saved ? JSON.parse(saved) : null;
  })).toMatchObject({
    profile: "economy",
    reviewModelId: "openai/gpt-6.1-sol",
    economyModelId: "qwen/qwen3.8-flash",
  });

  await page.getByTestId("checkbox-notebook-ai-consent").click();
  await page.getByTestId("input-assistant-question").fill("Объясни, что делает код");
  await page.getByTestId("button-submit-assistant-question").click();
  await expect(page.getByTestId("text-message-content-1"))
    .toContainText("Ответ ИИ по модели qwen/qwen3.8-flash");
});

test("clears the previous notebook state after a successful replacement", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await page.getByTestId("select-ai-model-review").click();
  await page.getByRole("option", { name: /openai\/gpt-6\.1-sol/ }).click();
  await page.getByTestId("parameter-prompt").fill("Пользовательский запрос первого блокнота");
  await page.getByTestId("button-run-cell-1").click();
  await expect(page.getByTestId("status-cell-simulated-1"))
    .toContainText("Пройдена в симуляции");

  await page.getByTestId("input-notebook-question").fill("Что происходит в ячейке 1?");
  await page.getByTestId("button-send-notebook-question").click();
  await expect(page.getByTestId("message-notebook-assistant-1"))
    .toContainText("Этот текст описывает подготовку данных.");

  await page.getByTestId("checkbox-notebook-ai-consent").click();
  await page.getByTestId("input-assistant-question").fill("Объясни первый блокнот");
  await page.getByTestId("button-submit-assistant-question").click();
  await expect(page.getByTestId("text-message-content-1"))
    .toContainText("Ответ ИИ по модели openai/gpt-6.1-sol");

  const replacement = notebookFile("second-notebook.ipynb", JSON.stringify({
    cells: [
      {
        cell_type: "markdown",
        id: "browser-intro",
        source: ["# Второй блокнот\n\nСодержимое второго документа."],
      },
      {
        cell_type: "code",
        id: "browser-parameters",
        source: ['prompt = "Запрос второго блокнота"\n', "temperature = 0.4"],
        outputs: [],
      },
      {
        cell_type: "code",
        id: "saved-result",
        execution_count: 1,
        source: ['print("Второй")'],
        outputs: [{
          output_type: "stream",
          name: "stdout",
          text: ["Результат второго блокнота\n"],
        }],
      },
    ],
  }));
  await page.getByTestId("input-replace-notebook").setInputFiles(replacement);

  await expect(page.locator('[data-notebook-cell-type="markdown"]'))
    .toContainText("Содержимое второго документа.");
  await expect(page.getByTestId("parameter-prompt"))
    .toHaveValue("Запрос второго блокнота");
  await expect(page.getByTestId("checkbox-notebook-ai-consent")).not.toBeChecked();
  await expect(page.getByTestId("text-message-content-1")).toHaveCount(0);
  await expect(page.getByTestId("text-cell-output-saved-result-0"))
    .toContainText("Результат второго блокнота");
  await expect(page.getByTestId("result-live-browser-parameters")).toHaveCount(0);
  await expect(page.getByText("Сохранённый результат: 12 строк")).toHaveCount(0);
  await expect(page.getByText("Пользовательский запрос первого блокнота")).toHaveCount(0);
  await expect(page.getByTestId("message-notebook-user-0")).toHaveCount(0);
  await expect(page.getByTestId("message-notebook-assistant-1")).toHaveCount(0);
  await expect(page.getByTestId("empty-assistant-conversation")).toBeVisible();
  await expect(page.getByTestId("message-assistant-user-0")).toHaveCount(0);
  await expect(page.getByTestId("message-assistant-assistant-1")).toHaveCount(0);
  await expect(page.getByTestId("input-assistant-question")).toHaveValue("");
});

test("explains why malformed notebook files cannot be opened", async ({ page }) => {
  const notifications = page.getByRole("region", { name: "Notifications (F8)" });
  const malformedFiles = [
    notebookFile("broken-json.ipynb", '{"cells": ['),
    notebookFile("missing-cells.ipynb", '{"metadata": {}}'),
    notebookFile("non-array-cells.ipynb", '{"cells": {}}'),
  ];

  for (const file of malformedFiles) {
    await page.getByTestId("input-upload-notebook").setInputFiles(file);

    await expect(notifications.getByText("Не удалось прочитать блокнот", { exact: true }))
      .toBeVisible();
    await expect(page.getByTestId("card-notebook-upload")).toBeVisible();
    if (file.name === "broken-json.ipynb") {
      await expect(notifications.getByText(
        "Файл повреждён: содержимое не является корректным JSON. Проверьте файл .ipynb и попробуйте снова.",
        { exact: true },
      )).toBeVisible();
    } else {
      await expect(notifications.getByText(
        "Файл не похож на Jupyter/Colab-блокнот: ожидался объект с массивом cells.",
        { exact: true },
      )).toBeVisible();
    }
  }
});

test("keeps the open notebook available after a failed replacement upload", async ({ page }) => {
  const notifications = page.getByRole("region", { name: "Notifications (F8)" });
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(page.getByTestId("text-cell-explanation-0"))
    .toContainText("Этот текст описывает подготовку данных.");

  const invalidReplacements = [
    notebookFile("replacement-broken-json.ipynb", "{ invalid"),
    notebookFile("replacement-without-cells.ipynb", '{"metadata": {}}'),
  ];

  for (const file of invalidReplacements) {
    await page.getByTestId("input-replace-notebook").setInputFiles(file);

    await expect(notifications.getByText("Не удалось прочитать блокнот", { exact: true }))
      .toBeVisible();
    await expect(page.getByTestId("text-cell-explanation-0"))
      .toContainText("Этот текст описывает подготовку данных.");
    await expect(page.getByTestId("card-notebook-assistant")).toBeVisible();
    await expect(page.getByTestId("button-download-notebook")).toBeVisible();
  }
});

test("restores opted-in cell settings after reload and lets the user reset them", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);

  const rememberSettings = page.getByTestId("switch-remember-cell-settings");
  const firstCodeCell = page.getByTestId("switch-cell-enabled-1");

  await rememberSettings.click();
  await expect(rememberSettings).toHaveAttribute("data-state", "checked");
  await firstCodeCell.click();
  await expect(firstCodeCell).toHaveAttribute("data-state", "unchecked");

  await page.reload();
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(rememberSettings).toHaveAttribute("data-state", "checked");
  await expect(firstCodeCell).toHaveAttribute("data-state", "unchecked");

  await page.getByTestId("button-reset-cell-settings").click();
  await expect(rememberSettings).toHaveAttribute("data-state", "unchecked");
  await expect(firstCodeCell).toHaveAttribute("data-state", "checked");

  await page.reload();
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(rememberSettings).toHaveAttribute("data-state", "unchecked");
  await expect(firstCodeCell).toHaveAttribute("data-state", "checked");
});

test("simulates enabled cells without requiring Colab or sending code", async ({ page }) => {
  const executionRequests: string[] = [];
  page.on("request", request => {
    if (
      request.url().includes("/api/colab/execute")
      || request.url().includes("/api/colab/run")
      || request.url().includes("/api/ai/analyze-notebook")
    ) {
      executionRequests.push(request.url());
    }
  });

  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await page.getByTestId("switch-cell-enabled-2").click();
  await page.getByTestId("button-run-enabled-cells").click();

  await expect(page.getByTestId("status-batch-run"))
    .toContainText("Симуляция завершена: просмотрено 1 из 1");
  await expect(page.getByTestId("status-cell-simulated-1")).toBeVisible();
  await expect(page.getByTestId("status-cell-skipped-2")).toBeVisible();
  await expect(page.getByTestId("simulation-no-output-browser-parameters"))
    .toContainText("Код не выполнялся");
  await expect(page.getByTestId("badge-saved-output-saved-result"))
    .toContainText("Сохранённый результат из исходного .ipynb");
  expect(executionRequests).toEqual([]);
});

test("simulation does not claim to catch runtime errors or fabricate outputs", async ({ page }) => {
  const executionRequests: string[] = [];
  page.on("request", request => {
    if (
      request.url().includes("/api/colab/execute")
      || request.url().includes("/api/colab/run")
      || request.url().includes("/api/ai/analyze-notebook")
    ) {
      executionRequests.push(request.url());
    }
  });

  await page.getByTestId("input-upload-notebook").setInputFiles({
    name: "batch-run.ipynb",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      cells: [
        { cell_type: "code", id: "first", source: "print('first')" },
        { cell_type: "code", id: "failed", source: "raise ValueError('invalid input')" },
        { cell_type: "code", id: "after-error", source: "print('must not run')" },
        { cell_type: "code", id: "disabled", source: "print('disabled')" },
      ],
    })),
  });
  await page.getByTestId("switch-cell-enabled-3").click();
  await page.getByTestId("button-run-enabled-cells").click();

  await expect(page.getByTestId("status-batch-run"))
    .toContainText("Симуляция завершена: просмотрено 3 из 3");
  await expect(page.getByTestId("status-cell-simulated-0")).toBeVisible();
  await expect(page.getByTestId("status-cell-simulated-1")).toBeVisible();
  await expect(page.getByTestId("status-cell-simulated-2")).toBeVisible();
  await expect(page.getByTestId("status-cell-error-1")).toHaveCount(0);
  await expect(page.getByTestId("simulation-no-output-failed"))
    .toContainText("Код не выполнялся");
  await expect(page.getByTestId("status-cell-skipped-3")).toBeVisible();
  expect(executionRequests).toEqual([]);
});

test("keeps the loaded notebook within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(page.getByTestId("card-notebook-assistant")).toBeVisible();

  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("main");
    const notebook = document.querySelector(".notebook-page");
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      mainClientWidth: main?.clientWidth ?? 0,
      mainScrollWidth: main?.scrollWidth ?? 0,
      notebookClientWidth: notebook?.clientWidth ?? 0,
      notebookScrollWidth: notebook?.scrollWidth ?? 0,
    };
  });

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.mainScrollWidth).toBeLessThanOrEqual(dimensions.mainClientWidth);
  expect(dimensions.notebookScrollWidth).toBeLessThanOrEqual(dimensions.notebookClientWidth);
});
