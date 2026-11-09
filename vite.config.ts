import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];

export default defineConfig({
  server: {
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    noDiscovery: false,
    entries: [
      "app/entry.client.tsx",
      "app/root.tsx",
      "app/components/**/*.{ts,tsx}",
      "app/routes/**/*.{ts,tsx}",
    ],
    include: [
      "@agent-native/toolkit/app/settings",
      "@agent-native/toolkit/app/chat",
      "@agent-native/toolkit/app/chat/agentkit-chat/index",
      "@agent-native/toolkit/app/chat/agentkit-chat/rail",
      "@agent-native/toolkit/app/chat/agentkit-chat/composer",
      "@agent-native/toolkit/app/chat/agentkit-chat/connections",
      "@agent-native/toolkit/app/chat/agentkit-chat/questions",
      "@agent-native/toolkit/app/chat/agentkit-chat/suggestions",
      "@agent-native/toolkit/app/agentkit/react/components",
      "@agent-native/toolkit/app/agentkit/react/context",
      "@agent-native/toolkit/app/agentkit/react/root",
      "@agent-native/toolkit/app/feedback",
      "@agent-native/toolkit/app/sharing",
      "@agent-native/toolkit/app/progress",
      "@agent-native/toolkit/ui/popover",
      "@agent-native/toolkit/ui/dropdown-menu",
      "@agent-native/toolkit/ui/dialog",
      "@agent-native/toolkit/ui/sheet",
      "@agent-native/toolkit/ui/skeleton",
      "@agent-native/toolkit/ui/tooltip",
      "@agent-native/toolkit/ui/button",
      "@agent-native/toolkit/utils",
      "@tabler/icons-react",
    ],
  },
  plugins: [
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      ssrStubs: ["shiki"],
    }),
  ],
});
