import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import type { Change } from "../server/lib/changes.js";
import { loadWorkspace, parseJson, runSummary } from "../server/lib/workspace.js";

type DemandBucket = { time: string; covers: number };
type PartyMix = Record<string, number>;

export default defineAction({
  description:
    "Load the live Double Shift workspace: venue, floor plan, sections, tables, stations, staff, menu, demand profile, scenarios, recent simulation runs, proposals and activity. Call this first before analysing a service or staging a change.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  searchHints: ["restaurant", "floor plan", "workspace", "current state"],
  run: async () => {
    const workspace = await loadWorkspace();
    const latestRunByScenario = new Map<string, ReturnType<typeof runSummary>>();
    for (const run of workspace.runs) {
      if (!latestRunByScenario.has(run.scenarioId)) {
        latestRunByScenario.set(run.scenarioId, runSummary(run));
      }
    }

    return {
      venue: workspace.venue,
      floor: workspace.floor,
      sections: workspace.sections,
      tables: workspace.tables,
      stations: workspace.stations,
      staff: workspace.staff,
      menu: workspace.menu,
      demandProfiles: workspace.demandProfiles.map((profile) => ({
        ...profile,
        curve: parseJson<DemandBucket[]>(profile.curveJson, []),
        partyMix: parseJson<PartyMix>(profile.partyMixJson, {}),
      })),
      scenarios: workspace.scenarios.map((scenario) => ({
        ...scenario,
        callouts: parseJson<string[]>(scenario.calloutsJson, []),
        changes: parseJson<Change[]>(scenario.changesJson, []),
        latestRun: latestRunByScenario.get(scenario.id) ?? null,
      })),
      proposals: workspace.proposals.map((proposal) => ({
        ...proposal,
        changes: parseJson<Change[]>(proposal.changesJson, []),
        expected: parseJson<Record<string, unknown>>(proposal.expectedJson, {}),
      })),
      runs: workspace.runs.map(runSummary),
      activity: workspace.activity,
      constraints: {
        maxReplications: 100,
        defaultReplications: 25,
        humanApprovalRequiredFor: ["apply-proposal"],
        simulator: "Double Shift deterministic service model v1",
      },
    };
  },
});
