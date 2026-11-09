import { markAgentChatHomeHandoff } from "@agent-native/toolkit/app/chat/agentkit-chat/rail";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { getChatHomeThreadId } from "@/lib/chat-home-thread";
import { chatThreadPath } from "@/lib/chat-paths";

export default function ChatHomeRedirect() {
  const [threadId] = useState(getChatHomeThreadId);
  const handoffStartedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (handoffStartedRef.current) return;
    handoffStartedRef.current = true;
    markAgentChatHomeHandoff("chat");
    try {
      navigate(chatThreadPath(threadId), { replace: true });
    } catch (error) {
      handoffStartedRef.current = false;
      throw error;
    }
  }, [navigate, threadId]);

  return null;
}
