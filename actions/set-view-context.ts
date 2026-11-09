import { defineAction } from "@agent-native/core/action";
import { writeAppState } from "@agent-native/core/application-state";
import { z } from "zod";

/**
 * The agent uses this to point the UI at the evidence it is discussing:
 * a scenario, a table, a time window, or the proposals view.
 */
export default defineAction({
  description:
    "Point the workspace UI at the subject of the conversation: select a scenario, focus a table, set the timeline window, or switch views. Use this before explaining a result so the human sees the same evidence.",
  schema: z.object({
    view: z.enum(["floor", "timeline", "proposals", "staff"]).optional(),
    scenarioId: z.string().nullable().optional(),
    runId: z.string().nullable().optional(),
    tableId: z.string().nullable().optional(),
    timeWindow: z
      .number()
      .int()
      .min(5)
      .max(60)
      .nullable()
      .optional()
      .describe("Timeline window in minutes"),
    heatmap: z.boolean().optional(),
  }),
  http: { method: "POST" },
  searchHints: ["focus", "select table", "show scenario", "open proposals"],
  run: async (args) => {
    const context = { ...args, _writeId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    await writeAppState("view-context", context);
    return { ok: true, viewContext: context };
  },
});
