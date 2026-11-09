import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description:
    "Read the Double Shift workspace context: current navigation, selected scenario, focused table, timeline window and view. Basic navigation is already included in <current-screen>; use this when you need the exact selection.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async () => {
    const [navigation, viewContext] = await Promise.all([
      readAppState("navigation"),
      readAppState("view-context"),
    ]);

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    if (viewContext) screen.viewContext = viewContext;

    if (Object.keys(screen).length === 0) {
      return "No workspace context has been written yet. The UI writes it when a scenario or table is selected.";
    }
    return screen;
  },
});
