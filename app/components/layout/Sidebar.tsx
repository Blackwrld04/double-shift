import { appPath } from "@agent-native/core/client/api-path";
import { signOut } from "@agent-native/core/client";
import { useT } from "@agent-native/core/client/i18n";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import {
  navigateWithAgentChatViewTransition,
  useAgentChatRunningThreads,
  useChatThreads,
} from "@agent-native/toolkit/app/chat/agentkit-chat/rail";
import {
  ownDraftRows,
  OwnershipChatHistoryRail,
  useOwnershipChatHistory,
} from "@agent-native/toolkit/app/chat/ownership-history";
import { openCommandMenu } from "@agent-native/toolkit/app/shared";
import {
  IconBuildingStore,
  IconChevronRight,
  IconLayoutGrid,
  IconLayoutList,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLoader2,
  IconLogout,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { formatClockTime, money } from "@/components/workspace/format";
import { APP_TITLE } from "@/lib/app-config";
import { chatThreadPath, HOME_PATH, threadIdFromPath } from "@/lib/chat-paths";
import { cn } from "@/lib/utils";

const CHAT_STORAGE_KEY = "chat";
const CHAT_ACTIVE_THREAD_KEY = `agent-chat-active-thread:${CHAT_STORAGE_KEY}`;

interface SidebarProps {
  collapsed?: boolean;
  collapsible?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function ThreadHistoryTitle({
  title,
  running,
}: {
  title: string;
  running: boolean;
}) {
  const t = useT();
  const viewportRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const overflow = Math.max(0, content.scrollWidth - viewport.clientWidth);
      const overflowing = overflow > 1;
      setIsOverflowing(overflowing);
      content.style.setProperty("--chat-sidebar-title-shift", `${overflow}px`);
      content.style.setProperty(
        "--chat-sidebar-title-duration",
        `${Math.max(1800, overflow * 24)}ms`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [title]);

  return (
    <span className="chat-sidebar-thread-title-shell">
      <span
        ref={viewportRef}
        className="chat-sidebar-thread-title"
        data-overflow={isOverflowing ? "true" : "false"}
      >
        <span ref={contentRef} className="chat-sidebar-thread-title__content">
          {title}
        </span>
      </span>
      {running ? (
        <IconLoader2
          className="chat-sidebar-thread-running size-4 shrink-0 motion-safe:animate-spin"
          strokeWidth={1.8}
          role="status"
          aria-label={t(
            // i18n-key-ignore shared framework catalog
            "agentChat.status.working",
          )}
        />
      ) : null}
    </span>
  );
}

function persistedActiveThreadId() {
  try {
    return localStorage.getItem(CHAT_ACTIVE_THREAD_KEY);
  } catch {
    return null;
  }
}

function persistActiveThreadId(threadId: string) {
  try {
    localStorage.setItem(CHAT_ACTIVE_THREAD_KEY, threadId);
  } catch {}
}

function ChatThreadsSection({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const {
    threads,
    activeThreadId,
    createThread,
    switchThread,
    pinThread,
    archiveThread,
    renameThread,
    isNewThread,
  } = useChatThreads(undefined, CHAT_STORAGE_KEY, undefined, {
    autoCreate: false,
    restoreActiveThread: false,
  });
  const { workingThreadIds, observedThreadStarts } =
    useAgentChatRunningThreads();

  const localMineRows = ownDraftRows({
    threads,
    isNewThread,
    observedThreadStarts,
  });
  const history = useOwnershipChatHistory({
    getThreadUrl: (threadId) => appPath(chatThreadPath(threadId)),
    activeId:
      threadIdFromPath(location.pathname) ??
      activeThreadId ??
      persistedActiveThreadId(),
    localMineRows,
    pinned: { label: t("chat.pinned") },
    mutations: {
      pin: pinThread,
      rename: renameThread,
      archive: archiveThread,
    },
    onMutationFailed: (kind) => {
      if (kind === "archive") toast.error(t("chat.archiveFailed"));
      if (kind === "rename") toast.error(t("chat.renameFailed"));
    },
    decorateItem: (item, row) => {
      const title = row.title || row.preview || t("chat.untitledChat");
      return {
        ...item,
        title: (
          <ThreadHistoryTitle
            title={title}
            running={workingThreadIds.has(row.id)}
          />
        ),
      };
    },
  });
  const displayedActiveThreadId =
    threadIdFromPath(location.pathname) ??
    activeThreadId ??
    persistedActiveThreadId();

  function openThread(threadId: string, options?: { isNew?: boolean }) {
    switchThread(threadId);
    persistActiveThreadId(threadId);
    if (options?.isNew) {
      window.dispatchEvent(
        new CustomEvent("agent-chat:open-thread", {
          detail: { threadId, newThread: true },
        }),
      );
    }
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
    if (options?.isNew) return;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("agent-chat:open-thread", {
          detail: { threadId, newThread: false },
        }),
      );
    });
  }

  async function handleNewChat() {
    const threadId = await createThread();
    if (threadId) openThread(threadId, { isNew: true });
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void handleNewChat()}
            className="ds-rail-icon-button"
            aria-label={t("chat.newChat")}
          >
            <IconMessageCircle className="size-4" strokeWidth={1.8} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("chat.newChat")}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="ds-rail-conversations">
      <div className="ds-rail-section-head">
        <span className="ds-rail-label">Conversations</span>
        <button
          type="button"
          className="ds-rail-add"
          onClick={() => void handleNewChat()}
          aria-label={t("chat.newChat")}
        >
          <IconPlus size={13} stroke={2} />
        </button>
      </div>
      <OwnershipChatHistoryRail
        {...history}
        onNewChat={() => void handleNewChat()}
        showNewChat={false}
        activeId={displayedActiveThreadId}
        onSelect={openThread}
        onDelete={async (threadId) => {
          const wasActive =
            threadId === activeThreadId ||
            threadId === persistedActiveThreadId();
          const archived = await history.listProps.onDelete?.(threadId);
          if (archived && wasActive) await handleNewChat();
        }}
        renameMaxLength={160}
        labels={{
          options: (item) =>
            t("chat.optionsFor", { title: item.titleText ?? "" }),
          renameInput: (item) =>
            t("chat.renameThread", { title: item.titleText ?? "" }),
          rename: t("chat.renameChat"),
          pin: t("chat.pinChat"),
          unpin: t("chat.unpinChat"),
          delete: t("chat.archiveChat"),
        }}
        railLabels={{
          newChat: t("chat.newChat"),
        }}
        className="chat-sidebar-history min-h-0 flex-1"
        listClassName="pb-2"
      />
    </div>
  );
}


function MainNavigation() {
  const { dockTab, setDockTab, workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === HOME_PATH;
  const staged =
    workspace?.proposals.filter((proposal) => proposal.status === "staged").length ?? 0;
  const staffCount =
    workspace?.staff.filter((member) => member.active).length ?? 0;

  function navigateTo(tab: "timeline" | "proposals" | "staff") {
    setDockTab(tab);
    if (location.pathname !== HOME_PATH) navigate(HOME_PATH);
  }

  return (
    <nav className="ds-rail-nav flex flex-col gap-1 w-full" aria-label="Main Navigation">
      <button
        type="button"
        className="ds-rail-nav-link"
        data-active={isHome && dockTab === "timeline" ? "true" : "false"}
        onClick={() => navigateTo("timeline")}
      >
        <IconLayoutGrid size={15} stroke={1.8} />
        <span>Floor Plan</span>
      </button>

      <button
        type="button"
        className="ds-rail-nav-link"
        data-active={isHome && dockTab === "proposals" ? "true" : "false"}
        onClick={() => navigateTo("proposals")}
      >
        <IconLayoutList size={15} stroke={1.8} />
        <span>Proposals</span>
        {staged > 0 ? (
          <span className="ml-auto text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
            {staged}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="ds-rail-nav-link"
        data-active={isHome && dockTab === "staff" ? "true" : "false"}
        onClick={() => navigateTo("staff")}
      >
        <IconUsers size={15} stroke={1.8} />
        <span>Team & Staff</span>
        {staffCount > 0 ? (
          <span className="ml-auto text-[9.5px] text-neutral-400">
            {staffCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="ds-rail-nav-link"
        onClick={() => focusAgentChat()}
      >
        <IconMessageCircle size={15} stroke={1.8} />
        <span>Operations Agent</span>
        <kbd className="ds-rail-kbd">⌘K</kbd>
      </button>
    </nav>
  );
}

function ScenarioRail() {
  const {
    workspace,
    selectedScenario,
    selectedScenarioId,
    selectScenario,
    runningScenarioId,
    isLoading,
    setOpenSetupModal,
  } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const scenarios = workspace?.scenarios ?? [];

  function openScenario(scenarioId: string) {
    selectScenario(scenarioId);
    if (location.pathname !== HOME_PATH) navigate(HOME_PATH);
  }

  if (workspace && workspace.onboarded === false) {
    return (
      <div className="ds-rail-product">
        <div className="ds-rail-venue">
          <span className="ds-rail-live" style={{ background: "#71717a" }} />
          <div className="ds-rail-venue-copy">
            <strong>New Restaurant</strong>
            <span>Setup required</span>
          </div>
        </div>
        <div className="p-3 text-xs text-neutral-400 leading-relaxed border-t border-neutral-800/60 mt-2">
          Complete the restaurant setup to configure your dining floor, kitchen stations, and live turn simulation.
        </div>
      </div>
    );
  }

  const activeDemand =
    workspace?.demandProfiles.find((profile) => profile.id === selectedScenario?.demandProfileId) ??
    workspace?.demandProfiles[0];
  const serviceWindow = activeDemand
    ? `${activeDemand.name} · ${formatClockTime(activeDemand.startTime)}–${formatClockTime(activeDemand.endTime)}`
    : "Service simulation";

  return (
    <div className="ds-rail-product">
      <div className="ds-rail-venue">
        <span className="ds-rail-live" />
        <div className="ds-rail-venue-copy">
          <strong>{workspace?.venue.name ?? "Restaurant Operations"}</strong>
          <span>{serviceWindow}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpenSetupModal(true)}
          className="text-neutral-400 hover:text-white transition-colors p-1"
          title="Restaurant settings & switcher"
          aria-label="Restaurant settings & switcher"
        >
          <IconBuildingStore size={14} stroke={1.8} />
        </button>
      </div>

      <div className="ds-rail-scenario-block">
        <div className="ds-rail-section-head">
          <button
            type="button"
            className="ds-rail-label-button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            What-If Scenarios
            <span className="ds-rail-count">{scenarios.length}</span>
          </button>
          <button
            type="button"
            className="ds-rail-add"
            onClick={() => focusAgentChat()}
            aria-label="Ask the agent to create a scenario"
            title="Ask the agent to create a scenario"
          >
            <IconPlus size={13} stroke={2} />
          </button>
        </div>
        {expanded ? (
          <div className="ds-rail-scenarios">
            {isLoading && scenarios.length === 0 ? (
              <div className="ds-rail-skeleton">
                <span />
                <span />
              </div>
            ) : null}
            {scenarios.map((scenario) => {
              const metrics = scenario.latestRun?.metrics;
              const isRunning = runningScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={cn(
                    "ds-rail-scenario",
                    selectedScenarioId === scenario.id && "is-selected",
                  )}
                  onClick={() => openScenario(scenario.id)}
                >
                  <span
                    className="ds-rail-scenario-pip"
                    data-status={scenario.status}
                    data-running={isRunning ? "true" : "false"}
                  />
                  <span className="ds-rail-scenario-copy">
                    <strong>{scenario.name}</strong>
                    <span>
                      {metrics
                        ? `${Math.round(metrics.coversSeated)} covers · ${Math.round(metrics.walkouts)} walkouts`
                        : isRunning
                          ? "simulating…"
                          : "not run yet"}
                    </span>
                  </span>
                  <IconChevronRight size={13} className="ds-rail-scenario-arrow" />
                </button>
              );
            })}
            <button type="button" className="ds-rail-scenario ds-rail-scenario-new" onClick={() => focusAgentChat()}>
              <span className="ds-rail-scenario-plus">
                <IconPlus size={12} stroke={2} />
              </span>
              <span className="ds-rail-scenario-copy">
                <strong>New what-if</strong>
                <span>ask agent to test a change</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed = false,
  collapsible = true,
  onCollapsedChange,
}: SidebarProps) {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, selectedScenario, setOpenSetupModal, setDockTab } = useWorkspace();
  const staged =
    workspace?.proposals.filter((proposal) => proposal.status === "staged").length ?? 0;
  if (workspace && workspace.onboarded === false) {
    return (
      <div className="ds-rail-product">
        <div className="ds-rail-venue">
          <span className="ds-rail-live" style={{ background: "#71717a" }} />
          <div className="ds-rail-venue-copy">
            <strong>New Restaurant</strong>
            <span>Setup required</span>
          </div>
        </div>
        <div className="p-3 text-xs text-neutral-400 leading-relaxed border-t border-neutral-800/60 mt-2">
          Complete the restaurant setup to configure your dining floor, kitchen stations, and live turn simulation.
        </div>
      </div>
    );
  }

  const activeDemand =
    workspace?.demandProfiles.find((profile) => profile.id === selectedScenario?.demandProfileId) ??
    workspace?.demandProfiles[0];
  const ToggleIcon = collapsed
    ? IconLayoutSidebarLeftExpand
    : IconLayoutSidebarLeftCollapse;
  const collapseButton = collapsible ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className="ds-rail-icon-button"
          aria-label={
            collapsed
              ? t("navigation.expandSidebar")
              : t("navigation.collapseSidebar")
          }
        >
          <ToggleIcon className="size-4" strokeWidth={1.8} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {collapsed
          ? t("navigation.expandSidebar")
          : t("navigation.collapseSidebar")}
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "ds-rail flex h-full min-w-0 shrink-0 flex-col overflow-hidden",
        collapsed ? "w-12" : "w-full",
      )}
    >
      <div className="ds-rail-head">
        <Link to="/" className="ds-rail-brand" aria-label={APP_TITLE}>
          <span className="ds-rail-mark">
            <span />
            <span />
          </span>
          {collapsed ? null : (
            <span className="ds-rail-brand-copy">
              <strong>Double Shift</strong>
              <span>operations twin</span>
            </span>
          )}
        </Link>
        {collapsed ? null : collapseButton}
      </div>

      {collapsed ? (
        <nav className="ds-rail-collapsed-nav" aria-label={t("navigation.navigation")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ds-rail-icon-button"
                onClick={() => {
                  setDockTab("timeline");
                  if (location.pathname !== HOME_PATH) navigate(HOME_PATH);
                }}
                aria-label="Floor Plan"
              >
                <IconLayoutGrid className="size-4" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Floor Plan</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ds-rail-icon-button"
                onClick={() => {
                  setDockTab("proposals");
                  if (location.pathname !== HOME_PATH) navigate(HOME_PATH);
                }}
                aria-label="Proposals"
              >
                <IconLayoutList className="size-4" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Proposals {staged > 0 ? `(${staged})` : ""}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ds-rail-icon-button"
                onClick={() => {
                  setDockTab("staff");
                  if (location.pathname !== HOME_PATH) navigate(HOME_PATH);
                }}
                aria-label="Team & Staff"
              >
                <IconUsers className="size-4" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Team & Staff</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ds-rail-icon-button"
                onClick={() => focusAgentChat()}
                aria-label="Ask the agent"
              >
                <IconMessageCircle className="size-4" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Operations Agent</TooltipContent>
          </Tooltip>
          {collapseButton}
        </nav>
      ) : (
        <div className="ds-rail-scroll">
          <div className="ds-rail-actions">
            <MainNavigation />
          </div>
          <ScenarioRail />
          <div className="ds-rail-chat">
            <ChatThreadsSection collapsed={false} />
          </div>
        </div>
      )}

      <div className="ds-rail-foot">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={openCommandMenu}
                  aria-label={t("root.commandSearch")}
                  className="ds-rail-icon-button"
                >
                  <IconSearch className="size-4" strokeWidth={1.8} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("root.commandSearch")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  aria-label="Log out"
                  className="ds-rail-icon-button"
                >
                  <IconLogout className="size-4" strokeWidth={1.8} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            <span className="ds-rail-foot-time">{activeDemand?.name ?? "Service simulation"}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpenSetupModal(true)}
                title="Restaurant settings & switcher"
                aria-label="Restaurant settings"
                className="ds-rail-icon-button"
              >
                <IconBuildingStore className="size-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={openCommandMenu}
                aria-label={t("root.commandSearch")}
                className="ds-rail-icon-button"
              >
                <IconSearch className="size-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                title="Log out"
                aria-label="Log out"
                className="ds-rail-icon-button"
              >
                <IconLogout className="size-4" strokeWidth={1.8} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
