import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
