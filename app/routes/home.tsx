import {
  IconAlertTriangle,
  IconClock,
  IconFlame,
  IconLayoutGrid,
  IconPlayerPlay,
  IconUsers,
} from "@tabler/icons-react";
import { useMemo } from "react";

import { FloorPlanPanel } from "@/components/workspace/FloorPlanPanel";
import { KpiStrip } from "@/components/workspace/KpiStrip";
import { ServiceDock } from "@/components/workspace/ServiceDock";
import { minutes, money, runAge, sectionStyle } from "@/components/workspace/format";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = `${APP_TITLE}: Friday service simulator`;
const SEO_DESCRIPTION =
  "Simulate a Friday dinner service at Osteria Nove. Test staffing, floor layout and demand over 10 to 50 simulated services, then apply only the changes you approve.";

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
  return <WorkspacePage />;
}

function WorkspacePage() {
  const {
    workspace,
    isLoading,
    error,
    selectedScenario,
    selectedScenarioId,
    run,
    replications,
    setReplications,
    runScenario,
    runningScenarioId,
    baselineMetrics,
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

  const worstSection = metrics?.sectionWaits?.[0];
  const netTone = (metrics?.net ?? 0) >= 0 ? "good" : "bad";
  const deltaNet =
    metrics && baselineMetrics ? metrics.net - baselineMetrics.net : undefined;

  return (
    <div className="ds-workspace">
      <header className="ds-hero">
        <div className="ds-hero-main">
          <div className="ds-eyebrow">
            Friday dinner service
            <span className="ds-eyebrow-divider" />
            Nov 13 · 5:00–10:30 PM
          </div>
          <h1 className="ds-hero-title">
            Osteria Nove
          </h1>
          <p className="ds-hero-copy">
            Change the floor plan, the roster or demand and see what it does to waits,
            walkouts and net. Nothing goes live until you apply it.
          </p>
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
            <span className="ds-hero-seed">seed 20261109</span>
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
            <p className="ds-scenario-card-copy">
              {selectedScenario?.description ||
                "A normal Friday at Osteria Nove. Use it as the control against every what-if."}
            </p>
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

      <div className="ds-summary-line">
        <div className="ds-summary-item">
          <span className="ds-summary-label">Net on the night</span>
          <strong data-tone={netTone}>{money(metrics?.net, true)}</strong>
          {deltaNet !== undefined && Math.abs(deltaNet) >= 1 ? (
            <em data-tone={deltaNet >= 0 ? "good" : "bad"}>
              {deltaNet >= 0 ? "+" : "−"}
              {money(Math.abs(deltaNet), true)} vs baseline
            </em>
          ) : (
            <em>after labor & overtime</em>
          )}
        </div>
        <div className="ds-summary-divider" />
        <div className="ds-summary-item">
          <span className="ds-summary-label">Guest experience</span>
          <strong>{minutes(metrics?.avgWait, 1)} avg wait</strong>
          <em>P95 {minutes(metrics?.p95Wait)} · {Math.round(metrics?.walkouts ?? 0)} walkouts</em>
        </div>
        <div className="ds-summary-divider" />
        <div className="ds-summary-item">
          <span className="ds-summary-label">Floor pressure</span>
          <strong>
            {worstSection ? `${worstSection.sectionName} ${minutes(worstSection.p95Wait)}` : "—"}
          </strong>
          <em>
            {metrics?.bottleneck ? `${metrics.bottleneck} queued ${minutes(metrics.stationLoad?.[0]?.maxQueue ?? 0)}` : "waiting for a run"}
          </em>
        </div>
        <div className="ds-summary-spacer" />
        <div className="ds-summary-hint">
          The agent can simulate and stage. You approve every live change.
        </div>
      </div>

      <KpiStrip />

      <div className="ds-workspace-grid">
        <FloorPlanPanel />
        <ServiceDock />
      </div>

      <footer className="ds-workspace-foot">
        <span>
          <span className="ds-foot-dot" />
          Seeded simulation: same inputs give the same result
        </span>
        <span>
          {sections.map((section) => (
            <span key={section.id} className="ds-foot-section">
              <span className="ds-foot-swatch" style={{ background: sectionStyle(section.id).color }} />
              {section.name}
            </span>
          ))}
        </span>
        <span className="ds-foot-rule">Human approval required for live changes</span>
      </footer>
    </div>
  );
}
