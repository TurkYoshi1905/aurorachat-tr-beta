import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    {
      name: "serve-exe-files",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.endsWith(".exe")) {
            const filePath = path.resolve(__dirname, "public", req.url.replace(/^\//, ""));
            if (fs.existsSync(filePath)) {
              const stat = fs.statSync(filePath);
              const fileName = path.basename(filePath);
              res.setHeader("Content-Type", "application/octet-stream");
              res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
              res.setHeader("Content-Length", stat.size);
              res.setHeader("Cache-Control", "no-cache");
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
