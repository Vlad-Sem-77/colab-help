import { Router, type IRouter } from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { db, historyTable } from "@workspace/db";
import {
  PingColabBody,
  FetchFreeModelsBody,
  RunExperimentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/colab/notebook", (_req, res): void => {
  const notebookPath = path.resolve(process.cwd(), "..", "..", "colab_backend.ipynb");
  if (!fs.existsSync(notebookPath)) {
    res.status(404).json({ error: "Notebook file not found" });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="colab_backend.ipynb"');
  res.setHeader("Content-Type", "application/json");
  res.sendFile(notebookPath);
});

router.post("/colab/execute", async (req, res): Promise<void> => {
  const { colabUrl, code } = req.body as { colabUrl?: string; code?: string };
  if (!colabUrl || typeof code !== "string") {
    res.status(400).json({ status: "error", stdout: "", stderr: "colabUrl and code are required" });
    return;
  }
  try {
    const response = await fetch(`${colabUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ status: "error", stdout: "", stderr: msg });
  }
});

router.post("/colab/ping", async (req, res): Promise<void> => {
  const parsed = PingColabBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { colabUrl } = parsed.data;
  try {
    const response = await fetch(`${colabUrl}/health`, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      res.json({ online: true, message: "Colab server is online" });
    } else {
      res.json({ online: false, message: `Server responded with HTTP ${response.status}` });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ online: false, message: `Could not reach Colab: ${msg}` });
  }
});

router.post("/colab/models", async (req, res): Promise<void> => {
  const parsed = FetchFreeModelsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { colabUrl } = parsed.data;
  try {
    const response = await fetch(`${colabUrl}/models/free`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Colab returned HTTP ${response.status}` });
      return;
    }
    const data = await response.json() as { models?: unknown[]; count?: number };
    const rawModels = data.models ?? [];

    const models = (rawModels as Array<Record<string, unknown>>).map((m) => ({
      id: String(m["id"] ?? ""),
      name: String(m["name"] ?? m["id"] ?? ""),
      description: m["description"] ? String(m["description"]) : null,
      contextLength: typeof m["context_length"] === "number" ? m["context_length"] : 0,
      topProvider: m["top_provider"] ? String(m["top_provider"]) : null,
      averageRating: typeof m["average_rating"] === "number" ? m["average_rating"] : null,
    }));

    res.json({ models, count: models.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to fetch models from Colab: ${msg}` });
  }
});

router.post("/colab/run", async (req, res): Promise<void> => {
  const parsed = RunExperimentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { colabUrl, taskType, mode, model, models: modelList, params } = parsed.data;

  const payload = {
    task_type: taskType,
    mode,
    model: model ?? null,
    models: modelList ?? [],
    params: {
      prompt: params.prompt,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      system_prompt: params.systemPrompt ?? null,
      custom_code: params.customCode ?? null,
    },
  };

  try {
    const response = await fetch(`${colabUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `Colab error HTTP ${response.status}: ${text}` });
      return;
    }

    const data = await response.json() as Record<string, unknown>;

    const modelCardRaw = data["model_card"] as Record<string, unknown> | undefined;
    const metricsRaw = data["metrics"] as Record<string, unknown> | undefined;
    const usageRaw = data["usage"] as Record<string, unknown> | undefined;

    const modelCard = modelCardRaw ? {
      id: String(modelCardRaw["id"] ?? data["model"] ?? ""),
      name: String(modelCardRaw["name"] ?? data["model"] ?? ""),
      topProvider: modelCardRaw["top_provider"] ? String(modelCardRaw["top_provider"]) : null,
      contextLength: typeof modelCardRaw["context_length"] === "number" ? modelCardRaw["context_length"] : null,
      averageRating: typeof modelCardRaw["average_rating"] === "number" ? modelCardRaw["average_rating"] : null,
      description: modelCardRaw["description"] ? String(modelCardRaw["description"]) : null,
    } : (data["model"] ? {
      id: String(data["model"]),
      name: String(data["model"]),
      topProvider: null,
      contextLength: null,
      averageRating: null,
      description: null,
    } : undefined);

    const promptTokens = Number(metricsRaw?.["prompt_tokens"] ?? usageRaw?.["prompt_tokens"] ?? 0);
    const completionTokens = Number(metricsRaw?.["completion_tokens"] ?? usageRaw?.["completion_tokens"] ?? 0);
    const totalTokens = Number(metricsRaw?.["total_tokens"] ?? usageRaw?.["total_tokens"] ?? 0);
    const executionTime = Number(metricsRaw?.["execution_time"] ?? data["execution_time"] ?? 0);

    const metrics = {
      promptTokens,
      completionTokens,
      totalTokens,
      executionTime,
    };

    const resultText = String(data["result"] ?? data["text"] ?? "");

    const comparisonsRaw = data["comparisons"] as Array<Record<string, unknown>> | undefined;
    const comparisons = comparisonsRaw?.map((c) => ({
      modelId: String(c["model_id"] ?? c["model"] ?? ""),
      result: String(c["result"] ?? ""),
      metrics: {
        promptTokens: Number(c["prompt_tokens"] ?? 0),
        completionTokens: Number(c["completion_tokens"] ?? 0),
        totalTokens: Number(c["total_tokens"] ?? 0),
        executionTime: Number(c["execution_time"] ?? 0),
      },
      error: c["error"] ? String(c["error"]) : null,
    }));

    await db.insert(historyTable).values({
      taskType,
      mode,
      model: modelCard?.id ?? model ?? null,
      prompt: params.prompt,
      result: resultText || null,
      promptTokens: promptTokens || null,
      completionTokens: completionTokens || null,
      totalTokens: totalTokens || null,
      executionTime: executionTime || null,
      modelName: modelCard?.name ?? null,
      modelProvider: modelCard?.topProvider ?? null,
      modelContextLength: modelCard?.contextLength ?? null,
    }).catch(() => {});

    res.json({
      status: "ok",
      taskType,
      mode,
      result: resultText || null,
      modelCard: modelCard ?? null,
      metrics,
      comparisons: comparisons ?? null,
      error: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      status: "error",
      taskType,
      mode,
      result: null,
      modelCard: null,
      metrics: null,
      comparisons: null,
      error: msg,
    });
  }
});

export default router;
