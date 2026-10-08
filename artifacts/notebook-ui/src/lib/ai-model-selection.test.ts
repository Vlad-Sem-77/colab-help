import test from "node:test";
import assert from "node:assert/strict";
import { getAiModelGroups, getDefaultAiModelId, getSelectableAiModels } from "./ai-model-selection.ts";

const aitunnelIds = [
  "qwen/qwen3.8-flash",
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-haiku-5.5",
  "z-ai/glm-5.3-flash",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-sol",
  "anthropic/claude-opus-5.5",
  "deepseek/deepseek-v4-pro",
];

test("limits AI Tunnel choices to the live fast and coding recommendations", () => {
  const catalog = [...aitunnelIds, "google/gemini-3.8-pro"];
  const groups = getAiModelGroups("aitunnel", catalog.map((id) => ({ id })));

  assert.deepEqual(groups.map((group) => group.label), [
    "Быстрые и недорогие",
    "Сильные для кодинга",
  ]);
  assert.deepEqual(getSelectableAiModels("aitunnel", catalog.map((id) => ({ id }))).map((model) => model.id), aitunnelIds);
});

test("keeps the selected provider's full catalog for non-AI-Tunnel providers", () => {
  const catalog = [{ id: "provider/model-a" }, { id: "provider/model-b" }];

  assert.deepEqual(getSelectableAiModels("proxyapi", catalog), catalog);
  assert.deepEqual(getSelectableAiModels("routerai", catalog), catalog);
  assert.deepEqual(getSelectableAiModels("openai", catalog), catalog);
});

test("never shows recommended AI Tunnel models that are absent from its live catalog", () => {
  const catalog = [{ id: "qwen/qwen3.8-flash" }, { id: "provider/unrelated" }];

  assert.deepEqual(getSelectableAiModels("aitunnel", catalog), [catalog[0]]);
});

test("chooses a sensible default model for each profile and provider", () => {
  const catalog = aitunnelIds.map((id) => ({ id }));

  assert.equal(getDefaultAiModelId("aitunnel", catalog, "review"), "openai/gpt-6.1-sol");
  assert.equal(getDefaultAiModelId("aitunnel", catalog, "economy"), "qwen/qwen3.8-flash");
  assert.equal(getDefaultAiModelId("proxyapi", [{ id: "proxyapi/first" }, { id: "proxyapi/second" }], "review"), "proxyapi/first");
});
