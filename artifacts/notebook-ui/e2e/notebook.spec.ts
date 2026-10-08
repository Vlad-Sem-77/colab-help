import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const notebookFixture = fileURLToPath(
  new URL("./fixtures/notebook-browser-scenario.ipynb", import.meta.url),
);

test.beforeEach(async ({ page }) => {
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

test("runs enabled parameter cells in order and skips disabled code cells", async ({ page }) => {
  const parameterRequests: unknown[] = [];
  const codeRequests: unknown[] = [];

  await page.route("**/api/colab/run", async route => {
    parameterRequests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        status: "ok",
        taskType: "text_generation",
        mode: "auto",
        result: "parameter cell completed",
        error: null,
      },
    });
  });
  await page.route("**/api/colab/execute", async route => {
    codeRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "ok", stdout: "code completed", stderr: "" } });
  });

  await page.getByTestId("input-colab-url").fill("https://example.trycloudflare.com");
  await page.getByTestId("input-upload-notebook").setInputFiles(notebookFixture);
  await page.getByTestId("switch-cell-enabled-2").click();
  await page.getByTestId("button-run-enabled-cells").click();

  await expect(page.getByTestId("status-batch-run"))
    .toContainText("Последовательный запуск завершён: 1 из 1");
  await expect(page.getByTestId("status-cell-success-1")).toBeVisible();
  await expect(page.getByTestId("status-cell-skipped-2")).toBeVisible();
  await expect(page.getByTestId("result-live-browser-parameters"))
    .toContainText("parameter cell completed");
  expect(parameterRequests).toHaveLength(1);
  expect(codeRequests).toHaveLength(0);
});

test("stops after the first error and shows it on the failed cell", async ({ page }) => {
  const executedSources: string[] = [];
  await page.route("**/api/colab/execute", async route => {
    const { code } = route.request().postDataJSON();
    executedSources.push(code);
    if (code.includes("raise")) {
      await route.fulfill({
        status: 502,
        json: { status: "error", stdout: "", stderr: "ValueError: invalid input" },
      });
      return;
    }
    await route.fulfill({ json: { status: "ok", stdout: "first completed", stderr: "" } });
  });

  await page.getByTestId("input-colab-url").fill("https://example.trycloudflare.com");
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
    .toContainText("Запуск остановлен на ячейке 2");
  await expect(page.getByTestId("status-batch-run"))
    .toContainText("Следующие ячейки не запускались");
  await expect(page.getByTestId("status-cell-success-0")).toBeVisible();
  await expect(page.getByTestId("status-cell-error-1")).toBeVisible();
  await expect(page.getByTestId("result-live-failed"))
    .toContainText("ValueError: invalid input");
  await expect(page.getByTestId("status-cell-success-2")).toHaveCount(0);
  await expect(page.getByTestId("status-cell-skipped-3")).toBeVisible();
  expect(executedSources).toEqual([
    "print('first')",
    "raise ValueError('invalid input')",
  ]);
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
