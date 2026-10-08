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
    const hasSessionKey = route.request().headers().cookie?.includes("notebook.sid=mock-session") ?? false;
    await route.fulfill({
      json: {
        providers: [
          { id: "aitunnel", name: "AI Tunnel", catalogRequiresKey: false, hasSessionKey, voiceInputAvailable: true, voiceOutputAvailable: true, transcriptionModelId: "whisper-1", speechModelId: "gpt-4o-mini-tts" },
          { id: "proxyapi", name: "ProxyAPI", catalogRequiresKey: true, hasSessionKey: false, voiceInputAvailable: true, voiceOutputAvailable: true, transcriptionModelId: "openai/gpt-4o-mini-transcribe", speechModelId: "openai/gpt-4o-mini-tts" },
          { id: "routerai", name: "RouterAI", catalogRequiresKey: false, hasSessionKey: false, voiceInputAvailable: true, voiceOutputAvailable: true, transcriptionModelId: "x-ai/grok-stt-1.0", speechModelId: "qwen/qwen-audio-3.0-tts-plus" },
          { id: "openai", name: "OpenAI", catalogRequiresKey: true, hasSessionKey: false, voiceInputAvailable: true, voiceOutputAvailable: true, transcriptionModelId: "gpt-4o-mini-transcribe", speechModelId: "gpt-4o-mini-tts" },
        ],
      },
    });
  });
  await page.route("**/api/ai/credentials/connect", async route => {
    await route.fulfill({
      status: 200,
      headers: { "Set-Cookie": "notebook.sid=mock-session; Path=/api; HttpOnly; SameSite=Strict" },
      json: { providerId: "aitunnel", connected: true },
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

test("uses the selected notebook theme for provider dropdowns", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  const providerSelect = page.getByTestId("select-ai-provider");

  await providerSelect.click();
  const lightListbox = page.getByRole("listbox");
  await expect(lightListbox).toBeVisible();
  await expect.poll(() => lightListbox.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(255, 255, 250)");

  await page.keyboard.press("Escape");
  await page.getByTestId("button-theme-windows95").click();
  await providerSelect.click();
  const windowsListbox = page.getByRole("listbox");
  await expect(windowsListbox).toBeVisible();
  await expect.poll(() => windowsListbox.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(222, 222, 222)");
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

test("keeps the provider key in the server browser session and supports voice questions and spoken answers", async ({ page }) => {
  const testSessionKey = "test-only-session-key";
  let keyWasSentOnConnect = false;
  let keyAppearedOutsideConnect = false;
  let analyzeSentKeyHeader = false;
  let analyzeCookie = "";
  let connectResponseIncludedKey = false;
  let transcribedAudioType = "";
  let speechGenerationRequests = 0;

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }),
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        this.mimeType = options?.mimeType ?? this.mimeType;
      }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["mock voice"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("pause"));
      },
    });
  });
  await page.reload();
  page.on("request", (request) => {
    if (!request.url().includes("/credentials/connect") && request.postData()?.includes(testSessionKey)) {
      keyAppearedOutsideConnect = true;
    }
  });
  await page.route("**/api/ai/credentials/connect", async (route) => {
    const body = route.request().postDataJSON() as { providerId?: string; apiKey?: string };
    keyWasSentOnConnect = body.providerId === "aitunnel" && body.apiKey === testSessionKey;
    const responseBody = { providerId: "aitunnel", connected: true };
    connectResponseIncludedKey = JSON.stringify(responseBody).includes(testSessionKey);
    await route.fulfill({
      status: 200,
      headers: { "Set-Cookie": "notebook.sid=mock-session; Path=/api; HttpOnly; SameSite=Strict" },
      json: responseBody,
    });
  });
  await page.route("**/api/ai/voice/transcribe**", async (route) => {
    transcribedAudioType = route.request().headers()["content-type"] ?? "";
    await route.fulfill({ json: { text: "Что делает этот ноутбук?" } });
  });
  await page.route("**/api/ai/voice/speech", async (route) => {
    speechGenerationRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      body: Buffer.from("mock-mp3-audio"),
    });
  });
  await page.route("**/api/ai/analyze-notebook", async route => {
    analyzeSentKeyHeader = Boolean(route.request().headers()["x-ai-provider-key"]);
    analyzeCookie = route.request().headers().cookie ?? "";
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

  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await page.getByTestId("input-ai-provider-key").fill(testSessionKey);
  await page.getByTestId("button-use-ai-provider-key").click();
  await expect(page.getByTestId("text-ai-session-key-active")).toBeVisible();
  expect(keyWasSentOnConnect).toBe(true);

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
  expect(connectResponseIncludedKey).toBe(false);
  const browserStorage = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  expect(browserStorage).not.toContain(testSessionKey);

  await page.getByTestId("checkbox-notebook-ai-consent").click();
  await page.getByTestId("button-record-assistant-question").click();
  await expect(page.getByTestId("button-record-assistant-question")).toContainText("Остановить запись");
  await page.getByTestId("button-record-assistant-question").click();
  await expect(page.getByTestId("input-assistant-question")).toHaveValue("Что делает этот ноутбук?");
  expect(transcribedAudioType).toBe("audio/webm");
  await page.getByTestId("button-submit-assistant-question").click();
  await expect(page.getByTestId("text-message-content-1"))
    .toContainText("Ответ ИИ по модели qwen/qwen3.8-flash");
  expect(analyzeSentKeyHeader).toBe(false);
  expect(analyzeCookie).toContain("notebook.sid=mock-session");
  expect(keyAppearedOutsideConnect).toBe(false);
  await page.getByTestId("button-speak-assistant-answer").click();
  await expect(page.getByTestId("audio-assistant-answer")).toHaveAttribute("src", /^blob:/);
  await expect(page.getByTestId("button-play-assistant-answer")).toBeVisible();
  const cachedAudioUrl = await page.getByTestId("audio-assistant-answer").getAttribute("src");
  expect(speechGenerationRequests).toBe(1);
  await page.getByTestId("button-play-assistant-answer").click();
  await expect(page.getByTestId("button-pause-assistant-answer")).toBeEnabled();
  await page.getByTestId("button-pause-assistant-answer").click();
  await expect(page.getByTestId("button-pause-assistant-answer")).toBeDisabled();
  await page.getByTestId("audio-assistant-answer").evaluate((audio) => {
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 12 });
  });
  await page.getByTestId("button-stop-assistant-answer").click();
  await expect(page.getByTestId("audio-assistant-answer")).toHaveJSProperty("currentTime", 0);
  await page.getByTestId("button-play-assistant-answer").click();
  await expect(page.getByTestId("button-pause-assistant-answer")).toBeEnabled();
  await expect(page.getByTestId("audio-assistant-answer")).toHaveAttribute("src", cachedAudioUrl ?? "");
  expect(speechGenerationRequests).toBe(1);

  await page.reload();
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(page.getByTestId("text-ai-session-key-active")).toBeVisible();
  await expect(page.getByTestId("input-ai-provider-key")).toHaveValue("");
  await expect(page.getByTestId("checkbox-notebook-ai-consent")).toBeEnabled();
});

test("clears the previous notebook state after a successful replacement", async ({ page }) => {
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await page.getByTestId("select-ai-model-review").click();
  await page.getByRole("option", { name: /openai\/gpt-6\.1-sol/ }).click();
  await page.getByTestId("input-ai-provider-key").fill("test-only-session-key");
  await page.getByTestId("button-use-ai-provider-key").click();
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
  await expect(page.locator(
    ".notebook-connect-panel, .notebook-page-subtitle, .notebook-upload-description, .notebook-upload-footnote, .notebook-cell-toggle-note",
  )).toHaveCount(0);
  await expect(page.getByTestId("notice-simulation-mode")).toHaveCount(0);
  await expect(page.getByTestId("status-simulation-mode"))
    .toHaveText("Симуляция · код не запускается");

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

  const sidebarIsAboveNotebook = () => page.evaluate(() => {
    const shell = document.querySelector(".notebook-app-shell");
    const sidebar = document.querySelector(".notebook-sidebar");
    const main = document.querySelector("main");
    if (!shell || !sidebar || !main) return false;
    const sidebarRect = sidebar.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return getComputedStyle(shell).flexDirection === "column"
      && Math.abs(sidebarRect.left - mainRect.left) < 1
      && sidebarRect.bottom <= mainRect.top + 1;
  });
  const documentActionsFit = () => page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".notebook-document-actions button, .notebook-document-actions label"));
    const viewportWidth = document.documentElement.clientWidth;
    return buttons.length === 3 && buttons.every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= viewportWidth + 1;
    });
  });
  expect(await sidebarIsAboveNotebook()).toBe(true);
  expect(await documentActionsFit()).toBe(true);

  await page.setViewportSize({ width: 980, height: 900 });
  expect(await sidebarIsAboveNotebook()).toBe(true);
  expect(await documentActionsFit()).toBe(true);
});

test("keeps the uploaded notebook after History navigation, screen rotation, and reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await expect(page.getByTestId("status-simulation-mode")).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Run History" })).toBeVisible();
  await page.getByRole("link", { name: "Notebook" }).click();
  await expect(page.getByTestId("status-simulation-mode")).toBeVisible();
  await expect(page.getByTestId("card-notebook-upload")).toHaveCount(0);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByTestId("status-simulation-mode")).toBeVisible();
  await page.reload();

  await expect(page.getByTestId("status-simulation-mode")).toBeVisible();
  await expect(page.getByTestId("card-notebook-upload")).toHaveCount(0);
});
