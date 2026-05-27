import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const historyTable = pgTable("experiments_history", {
  id: serial("id").primaryKey(),
  taskType: text("task_type").notNull(),
  mode: text("mode").notNull(),
  model: text("model"),
  prompt: text("prompt").notNull().default(""),
  result: text("result"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  executionTime: real("execution_time"),
  modelName: text("model_name"),
  modelProvider: text("model_provider"),
  modelContextLength: integer("model_context_length"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHistorySchema = createInsertSchema(historyTable).omit({ id: true, createdAt: true });
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
