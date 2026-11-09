import { navigateWithAgentChatViewTransition } from "@agent-native/core/client/agent-chat";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { type ReactNode } from "react";
import { useNavigate } from "react-router";

import { ChatComposerContextProvider } from "@/components/ChatComposerContext";
import { chatThreadPath } from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Contextual inspector shell used on secondary chat routes. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();

  function openAskAgentFullscreen(threadId?: string) {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
  }

  return (
    <AgentSidebar
      composerContextProvider={ChatComposerContextProvider}
      position="right"
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText="Ask Double Shift to stress-test a service, compare scenarios, or stage a layout or staffing change for your approval."
      agentPageHref="/settings/agent"
      suggestions={[
        "Stress-test Friday with rain and two callouts",
        "Can a floating server fix the rain scenario? Simulate it.",
        "Which station bottlenecks first at peak?",
      ]}
    >
      {children}
    </AgentSidebar>
  );
}
