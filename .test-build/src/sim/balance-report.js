"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBalanceReport = generateBalanceReport;
/** Escape HTML special characters to prevent injection */
function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
/** Create a safe DOM ID from a profile name */
function makeSafeId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 64); // Limit length for DOM IDs
}
function generateBalanceReport(results, title = "Balance Test Report") {
    const timestamp = new Date().toISOString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      padding: 2rem;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #0f9;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: #0f9;
      text-shadow: 0 0 10px rgba(0, 255, 153, 0.3);
    }
    .timestamp {
      color: #888;
      font-size: 0.9rem;
    }
    .profiles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }
    .profile-card {
      background: linear-gradient(135deg, #0f3a3a 0%, #0a2a3a 100%);
      border: 1px solid #0f9;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
    }
    .profile-card h2 {
      color: #0f9;
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-box {
      background: rgba(0, 0, 0, 0.3);
      border-left: 3px solid #0f9;
      padding: 1rem;
      border-radius: 4px;
    }
    .stat-label {
      color: #888;
      font-size: 0.85rem;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }
    .stat-value {
      color: #0f9;
      font-size: 1.5rem;
      font-weight: bold;
    }
    .stat-unit {
      color: #666;
      font-size: 0.9rem;
      margin-left: 0.5rem;
    }
    .chart-container {
      position: relative;
      height: 300px;
      margin-bottom: 1.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      padding: 1rem;
    }
    .milestones {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #0f9;
    }
    .milestones h3 {
      color: #0f9;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    .milestone-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #1a3a3a;
    }
    .milestone-name {
      flex: 1;
    }
    .milestone-bar {
      flex: 2;
      height: 20px;
      background: rgba(0, 255, 153, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin: 0 1rem;
    }
    .milestone-fill {
      height: 100%;
      background: linear-gradient(90deg, #0f9, #0f6);
      transition: width 0.3s;
    }
    .milestone-stat {
      width: 60px;
      text-align: right;
      font-size: 0.9rem;
      color: #0f9;
    }
    .comparison-section {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 2px solid #0f9;
    }
    .comparison-section h2 {
      color: #0f9;
      margin-bottom: 1.5rem;
    }
    .comparison-chart {
      background: linear-gradient(135deg, #0f3a3a 0%, #0a2a3a 100%);
      border: 1px solid #0f9;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .comparison-chart h3 {
      color: #0f9;
      margin-bottom: 1rem;
    }
    .chart-wrapper {
      position: relative;
      height: 400px;
    }
    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #0f9;
      text-align: center;
      color: #666;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚔️ ${escapeHtml(title)}</h1>
      <p class="timestamp">Generated: ${timestamp}</p>
    </div>

    <div class="profiles-grid">
      ${results.map((result) => generateProfileCard(result)).join("")}
    </div>

    ${results.length > 1 ? generateComparison(results) : ""}

    <footer>
      <p>Idle Dungeon Life - Balance Test Report</p>
      <p>Runs: ${results.reduce((sum, r) => sum + r.completedRuns, 0)} | Profiles: ${results.length}</p>
    </footer>
  </div>

  <script>
    ${generateChartScripts(results)}
  </script>
</body>
</html>`;
}
function generateProfileCard(result) {
    const safeId = makeSafeId(result.profileName);
    return `
    <div class="profile-card">
      <h2>${escapeHtml(result.profileName)}</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Avg Depth</div>
          <div class="stat-value">${result.averages.depth.toFixed(1)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Survival Time</div>
          <div class="stat-value">${(result.averages.survivalTime / 60).toFixed(0)}</div>
          <span class="stat-unit">min</span>
        </div>
        <div class="stat-box">
          <div class="stat-label">Dungeons Cleared</div>
          <div class="stat-value">${result.averages.totalDungeons.toFixed(1)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Discoveries</div>
          <div class="stat-value">${result.averages.discoveries.toFixed(1)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Completed Runs</div>
          <div class="stat-value">${result.completedRuns}</div>
          <span class="stat-unit">/ ${result.totalRuns}</span>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg Legacy Ash</div>
          <div class="stat-value">${Math.round(result.averages.ash)}</div>
        </div>
      </div>

      <div class="chart-container">
        <canvas id="depth-chart-${safeId}"></canvas>
      </div>

      ${Object.keys(result.milestoneStats).length > 0
        ? `
        <div class="milestones">
          <h3>Milestones</h3>
          ${Object.entries(result.milestoneStats)
            .map(([, stats]) => {
            const filled = (stats.percentReached / 100) * 100;
            return `
            <div class="milestone-item">
              <div class="milestone-name">${escapeHtml(stats.name)}</div>
              <div class="milestone-bar">
                <div class="milestone-fill" style="width: ${filled}%"></div>
              </div>
              <div class="milestone-stat">${stats.percentReached.toFixed(0)}%</div>
            </div>
          `;
        })
            .join("")}
        </div>
      `
        : ""}
    </div>
  `;
}
function generateComparison(_results) {
    return `
    <div class="comparison-section">
      <h2>📊 Profile Comparison</h2>

      <div class="comparison-chart">
        <h3>Average Depth by Profile</h3>
        <div class="chart-wrapper">
          <canvas id="comparison-depth"></canvas>
        </div>
      </div>

      <div class="comparison-chart">
        <h3>Average Survival Time by Profile</h3>
        <div class="chart-wrapper">
          <canvas id="comparison-survival"></canvas>
        </div>
      </div>

      <div class="comparison-chart">
        <h3>Discoveries by Profile</h3>
        <div class="chart-wrapper">
          <canvas id="comparison-discoveries"></canvas>
        </div>
      </div>
    </div>
  `;
}
function generateChartScripts(results) {
    return `
    const chartColor = (index) => {
      const colors = ['#0f9', '#0f6', '#06f', '#f60', '#f0f', '#ff0'];
      return colors[index % colors.length];
    };

    // Profile depth distribution charts
    ${results
        .map((result, idx) => {
        const safeId = makeSafeId(result.profileName);
        const depths = Object.keys(result.scoreDistribution);
        return `
      (function() {
        const ctx = document.getElementById('depth-chart-${safeId}');
        if (ctx) {
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(depths)},
              datasets: [{
                label: 'Runs',
                data: ${JSON.stringify(Object.values(result.scoreDistribution))},
                backgroundColor: chartColor(${idx}),
                borderColor: chartColor(${idx}),
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { color: '#888' }, grid: { color: '#1a3a3a' } },
                x: { ticks: { color: '#888' }, grid: { color: '#1a3a3a' } }
              }
            }
          });
        }
      })();
    `;
    })
        .join("")}

    // Comparison charts (if multiple profiles)
    if (${results.length} > 1) {
      const profileNames = ${JSON.stringify(results.map((r) => r.profileName))};
      const depths = ${JSON.stringify(results.map((r) => r.averages.depth))};
      const survivalTimes = ${JSON.stringify(results.map((r) => r.averages.survivalTime / 60))};
      const discoveries = ${JSON.stringify(results.map((r) => r.averages.discoveries))};

      // Depth comparison
      const depthCtx = document.getElementById('comparison-depth');
      if (depthCtx) {
        new Chart(depthCtx, {
          type: 'bar',
          data: {
            labels: profileNames,
            datasets: [{
              label: 'Average Depth',
              data: depths,
              backgroundColor: '#0f9',
              borderColor: '#0f6',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#888' } } },
            scales: {
              y: { beginAtZero: true, ticks: { color: '#888' }, grid: { color: '#1a3a3a' } },
              x: { ticks: { color: '#888' }, grid: { color: '#1a3a3a' } }
            }
          }
        });
      }

      // Survival time comparison
      const survivalCtx = document.getElementById('comparison-survival');
      if (survivalCtx) {
        new Chart(survivalCtx, {
          type: 'line',
          data: {
            labels: profileNames,
            datasets: [{
              label: 'Avg Survival (min)',
              data: survivalTimes,
              borderColor: '#0f6',
              backgroundColor: 'rgba(0, 255, 102, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#888' } } },
            scales: {
              y: { beginAtZero: true, ticks: { color: '#888' }, grid: { color: '#1a3a3a' } },
              x: { ticks: { color: '#888' }, grid: { color: '#1a3a3a' } }
            }
          }
        });
      }

      // Discoveries comparison
      const discoveriesCtx = document.getElementById('comparison-discoveries');
      if (discoveriesCtx) {
        new Chart(discoveriesCtx, {
          type: 'radar',
          data: {
            labels: profileNames,
            datasets: [{
              label: 'Avg Discoveries',
              data: discoveries,
              borderColor: '#06f',
              backgroundColor: 'rgba(0, 102, 255, 0.2)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#888' } } },
            scales: {
              r: { ticks: { color: '#888' }, grid: { color: '#1a3a3a' } }
            }
          }
        });
      }
    }
  `;
}
