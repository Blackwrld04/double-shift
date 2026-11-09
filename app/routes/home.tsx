import {
  IconAlertTriangle,
  IconBuildingStore,
  IconClock,
  IconFlame,
  IconLayoutGrid,
  IconPlayerPlay,
  IconUsers,
} from "@tabler/icons-react";
import { useMemo } from "react";

import { FloorPlanPanel } from "@/components/workspace/FloorPlanPanel";
import { KpiStrip } from "@/components/workspace/KpiStrip";
import { OnboardingSetupScreen } from "@/components/workspace/OnboardingSetupScreen";
import { ServiceDock } from "@/components/workspace/ServiceDock";
import { VenueOnboardingModal } from "@/components/workspace/VenueOnboardingModal";
import { formatClockTime, runAge } from "@/components/workspace/format";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = `${APP_TITLE}: restaurant operations twin`;
const SEO_DESCRIPTION =
  "Simulate restaurant service. Test staffing, floor layout and demand over 10 to 50 simulated services, then apply only the changes you approve.";

export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

export default function HomeRoute() {
  const { workspace, isLoading, error } = useWorkspace();

  if (isLoading && !workspace) {
    return (
      <div className="ds-workspace ds-workspace-loading">
        <div className="ds-loading-hero" />
        <div className="ds-loading-kpis">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span key={index} />
          ))}
        </div>
        <div className="ds-loading-grid">
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="ds-workspace ds-workspace-error">
        <div className="ds-error-card">
          <IconAlertTriangle size={22} stroke={1.7} />
          <h1>Could not load the workspace</h1>
          <p>{error.message}</p>
          <p className="ds-error-hint">Check that the database is running, then refresh the page.</p>
        </div>
      </div>
    );
  }

  // When a user has not onboarded yet, show the "Set Up Your Restaurant" screen instead of fixed data
  if (workspace && workspace.onboarded === false) {
    return <OnboardingSetupScreen />;
  }

  return <WorkspacePage />;
}

function WorkspacePage() {
  const {
    workspace,
    selectedScenario,
    selectedScenarioId,
    run,
    replications,
    setReplications,
    runScenario,
    runningScenarioId,
    baselineMetrics,
    setOpenSetupModal,
  } = useWorkspace();

  const metrics = run?.metrics ?? selectedScenario?.latestRun?.metrics;
  const isRunning = runningScenarioId === selectedScenarioId && Boolean(runningScenarioId);
  const tables = workspace?.tables ?? [];
  const sections = workspace?.sections ?? [];
  const staff = workspace?.staff ?? [];
  const stations = workspace?.stations ?? [];

  const tags = useMemo(() => {
    if (!selectedScenario) return [];
    const list = [
      selectedScenario.demandMultiplier !== 1
        ? `${selectedScenario.demandMultiplier.toFixed(2)}× demand`
        : "1.0× demand",
      selectedScenario.patioClosed ? "patio closed" : "full floor",
      selectedScenario.callouts.length > 0
        ? `${selectedScenario.callouts.length} callout${selectedScenario.callouts.length === 1 ? "" : "s"}`
        : "full team",
    ];
    if (selectedScenario.changes.length > 0) {
      list.push(`${selectedScenario.changes.length} staged change${selectedScenario.changes.length === 1 ? "" : "s"}`);
    }
    return list;
  }, [selectedScenario]);

  const activeDemand =
    workspace?.demandProfiles.find((profile) => profile.id === selectedScenario?.demandProfileId) ??
    workspace?.demandProfiles[0];
  const venueName = workspace?.venue.name ?? "Restaurant Operations Twin";
  const serviceName = activeDemand?.name ?? "Service simulation";
  const serviceWindow = activeDemand
    ? `${formatClockTime(activeDemand.startTime)}–${formatClockTime(activeDemand.endTime)}`
    : "5:00 PM–10:30 PM";

  return (
    <div className="ds-workspace">
      <VenueOnboardingModal />
      <header className="ds-hero">
        <div className="ds-hero-main">
          <div className="ds-eyebrow">
            {serviceName}
            <span className="ds-eyebrow-divider" />
            {serviceWindow}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="ds-hero-title">
              {venueName}
            </h1>
            <button
              type="button"
              onClick={() => setOpenSetupModal(true)}
              className="text-xs px-2.5 py-1 rounded border border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors inline-flex items-center gap-1.5"
              title="Configure restaurant or switch between custom and demo venue"
            >
              <IconBuildingStore size={13} stroke={1.8} />
              <span>Settings / Switch</span>
            </button>
          </div>
          <div className="ds-hero-meta">
            <span>
              <IconLayoutGrid size={13} stroke={1.8} />
              {tables.filter((table) => table.active).length} active tables
            </span>
            <span>
              <IconUsers size={13} stroke={1.8} />
              {staff.filter((member) => member.active).length} on the roster
            </span>
            <span>
              <IconFlame size={13} stroke={1.8} />
              {stations.length} kitchen stations
            </span>
          </div>
        </div>

        <div className="ds-hero-side">
          <div className="ds-scenario-card">
            <div className="ds-scenario-card-head">
              <div>
                <span className="ds-mini-label">Active scenario</span>
                <h2>{selectedScenario?.name ?? "Friday baseline"}</h2>
              </div>
              {selectedScenario?.status === "baseline" ? (
                <span className="ds-badge ds-badge-neutral">baseline</span>
              ) : (
                <span className="ds-badge ds-badge-accent">what-if</span>
              )}
            </div>
            <div className="ds-scenario-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="ds-scenario-card-foot">
              <span>
                <IconClock size={12} stroke={1.8} />
                {metrics ? `last run ${runAge(run?.createdAt ?? selectedScenario?.latestRun?.createdAt)}` : "not simulated yet"}
              </span>
              <span>{run?.replications ?? selectedScenario?.latestRun?.replications ?? replications} services</span>
            </div>
          </div>

          <div className="ds-run-controls">
            <div className="ds-reps" role="group" aria-label="Monte Carlo replications">
              {[10, 25, 50].map((value) => (
                <button
                  key={value}
                  type="button"
                  data-active={replications === value ? "true" : "false"}
                  onClick={() => setReplications(value)}
                  disabled={isRunning}
                >
                  {value}×
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ds-run-button"
              disabled={!selectedScenarioId || isRunning}
              onClick={() => {
                if (selectedScenarioId) void runScenario(selectedScenarioId, replications);
              }}
            >
              {isRunning ? (
                <>
                  <span className="ds-run-spinner" />
                  Simulating
                </>
              ) : (
                <>
                  <IconPlayerPlay size={15} stroke={2} />
                  Run service
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <KpiStrip />

      <div className="ds-workspace-grid">
        <FloorPlanPanel />
        <ServiceDock />
      </div>
    </div>
  );
}
