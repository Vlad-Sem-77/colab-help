import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, historyTable } from "@workspace/db";
import { DeleteHistoryEntryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/history", async (_req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(historyTable)
    .orderBy(desc(historyTable.createdAt))
    .limit(100);

  res.json(
    entries.map((e) => ({
      id: e.id,
      taskType: e.taskType,
      mode: e.mode,
      model: e.model,
      prompt: e.prompt,
      result: e.result,
      promptTokens: e.promptTokens,
      completionTokens: e.completionTokens,
      totalTokens: e.totalTokens,
      executionTime: e.executionTime,
      modelName: e.modelName,
      modelProvider: e.modelProvider,
      modelContextLength: e.modelContextLength,
      createdAt: e.createdAt.toISOString(),
    }))
  );
});

router.delete("/history", async (_req, res): Promise<void> => {
  await db.delete(historyTable);
  res.sendStatus(204);
});

router.delete("/history/:id", async (req, res): Promise<void> => {
  const params = DeleteHistoryEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(historyTable)
    .where(eq(historyTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "History entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
