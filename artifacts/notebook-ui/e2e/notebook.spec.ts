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
