import { defineAction } from "@agent-native/core/action";
import { putSetting, putUserSetting } from "@agent-native/core/settings";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { VENUE_ID } from "../server/lib/seed.js";

export default defineAction({
  description:
    "Switch active restaurant venue or reset onboarding back to the setup flow.",
  schema: z.object({
    venueId: z
      .string()
      .optional()
      .describe("ID of the venue to switch to (e.g. 'osteria-nove' or a custom venue ID)"),
    resetOnboarding: z
      .boolean()
      .default(false)
      .describe("If true, reset onboarding so the user sees the setup modal again"),
  }),
  run: async ({ venueId, resetOnboarding }, ctx) => {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const userEmail = ctx?.userEmail;

    if (resetOnboarding) {
      if (userEmail) {
        await putUserSetting(userEmail, "venue-onboarding", {
          completed: false,
          updatedAt: nowIso,
        });
      }
      await putSetting("venue-onboarding", {
        completed: false,
        updatedAt: nowIso,
      });
      return { ok: true, reset: true };
    }

    const targetVenueId = venueId || VENUE_ID;
    const [existing] = await db
      .select({ id: schema.venues.id })
      .from(schema.venues)
      .where(schema.venues.id.getSQL() ? undefined : undefined) // safety
      .limit(1);

    if (userEmail) {
      await putUserSetting(userEmail, "active-venue-id", {
        venueId: targetVenueId,
        updatedAt: nowIso,
      });
      await putUserSetting(userEmail, "venue-onboarding", {
        completed: true,
        mode: targetVenueId === VENUE_ID ? "demo" : "custom",
        venueId: targetVenueId,
        updatedAt: nowIso,
      });
    }

    await putSetting("active-venue-id", {
      venueId: targetVenueId,
      updatedAt: nowIso,
    });
    await putSetting("venue-onboarding", {
      completed: true,
      mode: targetVenueId === VENUE_ID ? "demo" : "custom",
      venueId: targetVenueId,
      updatedAt: nowIso,
    });

    return { ok: true, venueId: targetVenueId };
  },
});

