import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const dashboardDir = path.resolve(process.cwd(), "public", "balance-dashboard");
const reportsDir = path.join(dashboardDir, "reports");
const dashboardIndexPath = path.join(dashboardDir, "index.html");

function getBalanceReports() {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  return fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => {
      const filePath = path.join(reportsDir, entry.name);
      const stats = fs.statSync(filePath);
      return {
        fileName: entry.name,
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
        url: `/balance-dashboard/reports/${encodeURIComponent(entry.name)}`,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function createBalanceDashboardMiddleware() {
  return (req, res, next) => {
    const rawUrl = req.url ?? "";
    const requestPath = rawUrl.split("?")[0];

    if (requestPath === "/api/balance-reports") {
      const reports = getBalanceReports();
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            reports,
            count: reports.length,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    if ((requestPath === "/balance-dashboard" || requestPath === "/balance-dashboard/") && fs.existsSync(dashboardIndexPath)) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(fs.readFileSync(dashboardIndexPath, "utf8"));
      return;
    }

    next();
  };
}

function balanceDashboardEndpointsPlugin() {
  return {
    name: "balance-dashboard-endpoints",
    configureServer(server) {
      server.middlewares.use(createBalanceDashboardMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createBalanceDashboardMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [balanceDashboardEndpointsPlugin()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }
          if (id.includes("/src/content/")) {
            return "content";
          }
          if (id.includes("/src/ui/scenes/")) {
            return "ui-scenes";
          }
          if (id.includes("/src/core/") || id.includes("/src/sim/")) {
            return "core-sim";
          }
          return undefined;
        },
      },
    },
  },
});
