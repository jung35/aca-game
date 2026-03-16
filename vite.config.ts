import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0", // bind to all interfaces so the port is reachable from the host
    port: 5173,
    strictPort: true, // fail if 5173 is already taken instead of auto-incrementing
    watch: {
      // Use polling when running inside Docker on Linux/WSL2 bind mounts where
      // inotify events from the host file system don't propagate into the container.
      usePolling: true,
      interval: 300, // ms — lower = faster HMR, higher = less CPU
    },
  },
});
