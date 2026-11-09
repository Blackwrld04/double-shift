import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

export type WorkspaceData = AgentNativeActionRegistry["get-workspace"]["result"];
export type Scenario = WorkspaceData["scenarios"][number];
export type DiningTable = WorkspaceData["tables"][number];
export type Section = WorkspaceData["sections"][number];
export type StaffMember = WorkspaceData["staff"][number];
export type Proposal = WorkspaceData["proposals"][number];
export type RunDetail = AgentNativeActionRegistry["get-run"]["result"];
export type RunMetrics = RunDetail["metrics"];
export type TimelinePoint = RunDetail["timeline"][number];
export type RunEvent = RunDetail["events"][number];
export type LiveRun = AgentNativeActionRegistry["run-scenario"]["result"];

export type DockTab = "timeline" | "proposals" | "staff";

export type RunView = {
  runId: string;
  scenarioId: string;
  scenarioName: string;
  createdAt?: string;
  replications: number;
  metrics: RunMetrics;
  timeline: TimelinePoint[];
  events: RunEvent[];
};

type WorkspaceContextValue = {
  workspace: WorkspaceData | undefined;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<unknown>;
  selectedScenario: Scenario | undefined;
  selectedScenarioId: string | null;
  selectScenario: (scenarioId: string) => void;
  selectedTable: DiningTable | undefined;
  selectedTableId: string | null;
  selectTable: (tableId: string | null) => void;
  dockTab: DockTab;
  setDockTab: (tab: DockTab) => void;
  heatmap: boolean;
  setHeatmap: (value: boolean) => void;
  replications: number;
  setReplications: (value: number) => void;
  run: RunView | undefined;
  runningScenarioId: string | null;
  runScenario: (scenarioId: string, replications?: number) => Promise<LiveRun>;
  baselineMetrics: RunMetrics | undefined;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const FLOOR_VIEW: DockTab = "timeline";

function toRunView(data: RunDetail | undefined): RunView | undefined {
  if (!data) return undefined;
  return {
    runId: data.run.id,
    scenarioId: data.run.scenarioId,
    scenarioName: data.run.scenarioName,
    createdAt: data.run.createdAt,
    replications: data.run.replications,
    metrics: data.metrics,
    timeline: data.timeline,
    events: data.events,
  };
}

function toLiveRunView(data: LiveRun | null): RunView | undefined {
  if (!data) return undefined;
  return {
    runId: data.runId,
    scenarioId: data.scenarioId,
    scenarioName: data.scenarioName,
    replications: data.metrics.replications ?? 25,
    metrics: data.metrics,
    timeline: data.timeline,
    events: data.events,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const workspaceQuery = useActionQuery("get-workspace", {});
  const workspace = workspaceQuery.data;

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [dockTab, setDockTab] = useState<DockTab>("timeline");
  const [heatmap, setHeatmap] = useState(false);
  const [replications, setReplications] = useState(25);
  const [liveRun, setLiveRun] = useState<LiveRun | null>(null);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const autoRunStarted = useRef(false);
  const lastAppliedContext = useRef<string | null>(null);

  const baseline = useMemo(
    () =>
      workspace?.scenarios.find((scenario) => scenario.status === "baseline") ??
      workspace?.scenarios[0],
    [workspace],
  );

  useEffect(() => {
    if (!workspace) return;
    if (selectedScenarioId && workspace.scenarios.some((scenario) => scenario.id === selectedScenarioId)) {
      return;
    }
    setSelectedScenarioId(baseline?.id ?? workspace.scenarios[0]?.id ?? null);
  }, [workspace, selectedScenarioId, baseline]);

  const selectedScenario = useMemo(
    () => workspace?.scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? baseline,
    [workspace, selectedScenarioId, baseline],
  );

  const selectedTable = useMemo(
    () => workspace?.tables.find((table) => table.id === selectedTableId),
    [workspace, selectedTableId],
  );

  const runId = selectedScenario?.latestRun?.id;
  const runQuery = useActionQuery(
    "get-run",
    { runId: runId ?? "" },
    { enabled: Boolean(runId) },
  );

  const runMutation = useActionMutation("run-scenario");
  const runScenario = useCallback(
    async (scenarioId: string, reps = replications) => {
      setRunningScenarioId(scenarioId);
      try {
        const result = await runMutation.mutateAsync({
          scenarioId,
          replications: reps,
        });
        setSelectedScenarioId(scenarioId);
        setLiveRun(result);
        setDockTab("timeline");
        await workspaceQuery.refetch();
        return result;
      } finally {
        setRunningScenarioId(null);
      }
    },
    [runMutation, replications, workspaceQuery],
  );

  // Populate the twin on first open: a workspace with no runs is not useful,
  // and the baseline is deterministic, so this is a safe read-like warm-up.
  useEffect(() => {
    if (!workspace || autoRunStarted.current) return;
    autoRunStarted.current = true;
    if (workspace.runs.length === 0 && baseline) {
      void runScenario(baseline.id, 25).catch(() => {
        // The surface still works without a run; errors are shown by the query.
      });
    }
  }, [workspace, baseline, runScenario]);

  const viewWrite = useActionMutation("set-view-context", {
    skipActionQueryInvalidation: true,
  });

  useEffect(() => {
    if (!selectedScenarioId) return;
    const timer = window.setTimeout(() => {
      void viewWrite
        .mutateAsync({
          view: dockTab,
          scenarioId: selectedScenarioId,
          tableId: selectedTableId,
          heatmap,
        })
        .catch(() => {
          // Application state is advisory; a failure must not break the UI.
        });
    }, 500);
    return () => window.clearTimeout(timer);
    // viewWrite is stable; excluding it prevents a write loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenarioId, selectedTableId, dockTab, heatmap]);

  // The agent can focus the workspace with set-view-context. Poll the small
  // app-state read only while the workspace is on screen.
  const screenQuery = useActionQuery("view-screen", {}, {
    enabled: location.pathname === "/home",
    refetchInterval: 4000,
  });

  useEffect(() => {
    const data = screenQuery.data;
    if (!data || typeof data !== "object") return;
    const context = (data as { viewContext?: Record<string, unknown> }).viewContext;
    if (!context) return;
    const writeId = typeof context._writeId === "string" ? context._writeId : null;
    if (!writeId || writeId === lastAppliedContext.current) return;
    lastAppliedContext.current = writeId;
    if (typeof context.scenarioId === "string") setSelectedScenarioId(context.scenarioId);
    if (context.tableId === null) setSelectedTableId(null);
    else if (typeof context.tableId === "string") setSelectedTableId(context.tableId);
    if (typeof context.heatmap === "boolean") setHeatmap(context.heatmap);
    if (context.view === "proposals" || context.view === "staff" || context.view === "timeline") {
      setDockTab(context.view);
    } else if (context.view === "floor") {
      setDockTab(FLOOR_VIEW);
    }
  }, [screenQuery.data]);

  const fetchedRun = toRunView(runQuery.data);
  const liveRunView = toLiveRunView(liveRun);
  const run =
    liveRunView && liveRunView.scenarioId === selectedScenario?.id
      ? liveRunView
      : fetchedRun?.scenarioId === selectedScenario?.id
        ? fetchedRun
        : undefined;

  const value: WorkspaceContextValue = {
    workspace,
    isLoading: workspaceQuery.isLoading,
    error: (workspaceQuery.error as Error | null) ?? null,
    refresh: () => workspaceQuery.refetch(),
    selectedScenario,
    selectedScenarioId: selectedScenario?.id ?? null,
    selectScenario: (scenarioId) => {
      setSelectedScenarioId(scenarioId);
      setSelectedTableId(null);
      setLiveRun((current) => (current?.scenarioId === scenarioId ? current : null));
    },
    selectedTable,
    selectedTableId,
    selectTable: (tableId) => setSelectedTableId(tableId),
    dockTab,
    setDockTab,
    heatmap,
    setHeatmap,
    replications,
    setReplications,
    run,
    runningScenarioId,
    runScenario,
    baselineMetrics: baseline?.latestRun?.metrics,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
