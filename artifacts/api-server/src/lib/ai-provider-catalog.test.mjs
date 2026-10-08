import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAiCatalog } from "./ai-provider-catalog.ts";

test("uses AI Tunnel model IDs and ruble prices exactly as returned", () => {
  const models = normalizeAiCatalog("aitunnel", [
    { name: "openai/gpt-6-luna", prompt_cost: 20, completion_cost: 100 },
    { name: "qwen/qwen3.8-flash", prompt_cost: 30, completion_cost: 94 },
  ]);

  assert.deepEqual(models.map((model) => model.id), [
    "openai/gpt-6-luna",
    "qwen/qwen3.8-flash",
  ]);
  assert.equal(models[0].inputPricePerMillion, 20);
  assert.equal(models[0].outputPricePerMillion, 100);
  assert.equal(models[0].currency, "RUB");
});

test("reads RouterAI wrapped catalogs and converts rubles per token to per million", () => {
  const models = normalizeAiCatalog("routerai", [{
    data: [{
      id: "deepseek/deepseek-chat-v3.1",
      name: "DeepSeek Chat V3.1",
      context_length: 65536,
      architecture: { output_modalities: ["text"] },
      pricing: { prompt: 0.000003, completion: 0.000012 },
      pricing_units: { prompt: "token", completion: "token" },
    }],
  }]);

  assert.equal(models.length, 1);
  assert.equal(models[0].id, "deepseek/deepseek-chat-v3.1");
  assert.equal(models[0].contextLength, 65536);
  assert.equal(models[0].inputPricePerMillion, 3);
  assert.equal(models[0].outputPricePerMillion, 12);
  assert.equal(models[0].currency, "RUB");
});

test("retains ProxyAPI and OpenAI catalog IDs while excluding non-chat models", () => {
  const proxyModels = normalizeAiCatalog("proxyapi", {
    data: [
      { id: "anthropic/claude-sonnet-current", owned_by: "anthropic" },
      { id: "text-embedding-3-large", owned_by: "openai" },
    ],
  });
  const openAiModels = normalizeAiCatalog("openai", {
    data: [
      { id: "gpt-6.1-sol", owned_by: "openai" },
      { id: "whisper-1", owned_by: "openai" },
    ],
  });

  assert.deepEqual(proxyModels.map((model) => model.id), ["anthropic/claude-sonnet-current"]);
  assert.equal(proxyModels[0].ownedBy, "anthropic");
  assert.equal(proxyModels[0].inputPricePerMillion, null);
  assert.deepEqual(openAiModels.map((model) => model.id), ["gpt-6.1-sol"]);
});

test("removes duplicate model IDs without changing provider order", () => {
  const models = normalizeAiCatalog("openai", {
    data: [
      { id: "gpt-6.1-sol" },
      { id: "gpt-6.1-sol" },
      { id: "gpt-6-luna" },
    ],
  });

  assert.deepEqual(models.map((model) => model.id), ["gpt-6.1-sol", "gpt-6-luna"]);
});
