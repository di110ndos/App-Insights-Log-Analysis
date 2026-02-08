# Pulse

A high-performance React application for analyzing Azure Application Insights CSV log exports. Process and visualize logs entirely in the browser with no backend required.

## Why Use This Tool?

Azure App Insights excels at log collection and querying, but Pulse fills gaps for **rapid triage and pattern recognition**:

| Gap | Azure App Insights | Pulse |
|-----|-------------------|-----------|
| **Error Pattern Grouping** | Shows individual log entries | Normalizes messages (strips GUIDs, timestamps, IDs) to group similar errors automatically |
| **Offline Analysis** | Requires live connection | Runs entirely in browser — data never leaves your machine |
| **Visual Time Selection** | Requires KQL queries | Drag across chart to filter to specific time windows |
| **API Health View** | Requires custom queries/workbooks | Auto-extracts `/api/` endpoints and shows error rates at a glance |
| **Before/After Comparison** | Manual KQL comparison | Drag-and-drop two CSVs to see new errors, resolved issues, and trends |
| **AI Analysis (5 modes)** | Limited "Smart Detection" for anomalies | Health scoring, root cause analysis, incident timelines, API health reports, and remediation playbooks with KQL queries |
| **Setup Required** | Configure workspaces, write KQL, build dashboards | Export CSV → Drop file → Get insights |

## Features

### Log Visualization
- **Interactive Frequency Chart** - Visualize log volume over time with stacked bars by severity (Verbose, Info, Warning, Error, Critical)
- **Adjustable Granularity** - Switch between 1 min, 5 min, 15 min, 30 min, 1 hour, 6 hour, and 1 day buckets
- **Timezone Selector** - View timestamps in Local, PT, CT, ET, or UTC
- **Drag-to-Select** - Click and drag on the chart to filter logs to a specific time range
- **Smart Axis Labels** - Date+time on multi-day ranges, date-only for daily granularity, auto-spaced ticks

### Log Grid
- **Virtual Scrolling** - Handle large datasets (50MB+) with AG Grid's virtualization
- **Row Coloring** - Errors highlighted in red, warnings in yellow, critical in orange
- **Quick Filtering** - Debounced search across all columns with severity and server role toggles
- **Detail Drawer** - Click any row to see full log details including operation ID correlation
- **CSV Export** - Export filtered logs to CSV

### Pattern Detection
- **Automatic Grouping** - Similar errors and warnings are grouped by normalized message patterns
- **Severity Badges** - Each pattern shows whether it's primarily errors (red), warnings (yellow), or critical (orange)
- **Frequency Tracking** - See first/last occurrence and total count for each pattern
- **Chart Integration** - Click a pattern to highlight its occurrences as a purple overlay line on the frequency chart

### API Errors Tracking
- **Endpoint Extraction** - Automatically identifies `/api/` endpoints from log messages
- **Method Detection** - Shows HTTP methods (GET, POST, PUT, DELETE) when available
- **Status Code Breakdown** - See which status codes are occurring for each endpoint
- **Error Prioritization** - Endpoints sorted by error count for quick identification

### AI-Powered Analysis (5 Modes)
Powered by Claude API with structured JSON output and rich rendering:

| Mode | What It Does |
|------|-------------|
| **Health Overview** | System health score (0-100), severity trends, per-server-role assessment |
| **Root Cause** | Error chain analysis, co-occurring errors in 1-minute windows, dependency failure categorization |
| **Incident Timeline** | Chronological event reconstruction, spike detection, trigger identification |
| **API Health** | Per-endpoint error rates, status code analysis, specific fix recommendations |
| **Remediation** | Prioritized fix playbook with copyable KQL queries and syntax-highlighted code suggestions |

Each mode builds focused context from your log data and sends it to Claude for deep analysis. Results include severity-colored sections, KQL monitoring queries, and actionable code/config fixes.

### File Comparison
- **Diff View** - Compare two log files to see what changed
- **New Errors** - Identify errors appearing in the new file but not the baseline
- **Resolved Errors** - See which errors were fixed
- **Trend Analysis** - Track patterns that increased or decreased in frequency

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/di110ndos/App-Insights-Log-Analysis.git
cd App-Insights-Log-Analysis

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

For AI-powered analysis, create a `.env` file in the project root:

```
VITE_ANTHROPIC_API_KEY=your-api-key-here
```

The `.env` file is gitignored and your key never leaves the browser.

### Usage

1. Open http://localhost:5173 in your browser
2. Drag and drop a CSV file exported from Azure App Insights
3. Use the chart and filters to explore your logs
4. Click the **Patterns** tab to see grouped error patterns
5. Click the **API Errors** tab to analyze API endpoint issues
6. Click the **AI Analysis** tab and select one of 5 analysis modes

### Exporting from Azure App Insights

1. Go to your Application Insights resource in Azure Portal
2. Navigate to **Logs** (under Monitoring)
3. Run a query like:
   ```kusto
   traces
   | where timestamp > ago(24h)
   | project timestamp, severityLevel, message, customDimensions, operation_Id, cloud_RoleName
   ```
4. Click **Export** → **Export to CSV**

## Tech Stack

- **React 18** - UI framework with lazy-loaded tabs
- **Vite 5** - Build tool and dev server
- **TypeScript 5** - Strict mode type safety
- **AG Grid Community 31** - High-performance data grid
- **Recharts 2.10** - Charting library
- **Tailwind CSS 3.4** - Dark-mode-only styling
- **PapaParse 5.4** - CSV parsing (via Web Worker for large files)
- **Vitest 4** - Testing (183 tests across utilities and components)

## Performance

- **Web Worker CSV parsing** - Large files parsed off the main thread with progress reporting
- **Virtual scrolling** - Smooth navigation of datasets with 100k+ rows
- **Memoized computations** - All data transforms use `useMemo`, handlers use `useCallback`
- **Lazy-loaded tabs** - AI Analysis and File Comparison loaded on demand via `React.lazy`
- **Debounced search** - 300ms debounce on filter input to prevent excessive re-renders
- No backend required - all processing happens client-side

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

183 tests covering CSV parsing, pattern normalization, severity handling, timestamp parsing, file comparison, and component rendering (ErrorPatterns, DetailDrawer, FilterBar).

## License

MIT
