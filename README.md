# Azure App Insights Log Analyzer

A high-performance React application for analyzing Azure Application Insights CSV log exports. Process and visualize logs entirely in the browser with no backend required.

## Why Use This Tool?

Azure App Insights excels at log collection and querying, but this tool fills gaps for **rapid triage and pattern recognition**:

| Gap | Azure App Insights | This Tool |
|-----|-------------------|-----------|
| **Error Pattern Grouping** | Shows individual log entries | Normalizes messages (strips GUIDs, timestamps, IDs) to group similar errors automatically |
| **Offline Analysis** | Requires live connection | Runs entirely in browser—data never leaves your machine |
| **Visual Time Selection** | Requires KQL queries | Drag across chart to filter to specific time windows |
| **API Health View** | Requires custom queries/workbooks | Auto-extracts `/api/` endpoints and shows error rates at a glance |
| **Before/After Comparison** | Manual KQL comparison | Drag-and-drop two CSVs to see new errors, resolved issues, and trends |
| **AI Root Cause Analysis** | Limited "Smart Detection" for anomalies | Send grouped patterns to Claude for actionable recommendations |
| **Setup Required** | Configure workspaces, write KQL, build dashboards | Export CSV → Drop file → Get insights |

## Features

### Log Visualization
- **Interactive Frequency Chart** - Visualize log volume over time with stacked bars by severity
- **Adjustable Granularity** - Switch between 1 min, 5 min, 15 min, 30 min, 1 hour, 6 hour, and 1 day buckets
- **Drag-to-Select** - Click and drag on the chart to filter logs to a specific time range
- **Persistent Selection** - Selected time ranges stay highlighted with a dashed border

### Log Grid
- **Virtual Scrolling** - Handle large datasets (50MB+) with AG Grid's virtualization
- **Row Coloring** - Errors highlighted in red, warnings in yellow
- **Quick Filtering** - Search across all columns or specific fields
- **Detail Drawer** - Click any row to see full log details in a side panel

### Pattern Detection
- **Automatic Grouping** - Similar errors and warnings are grouped by normalized message patterns
- **Severity Badges** - Each pattern shows whether it's primarily errors (red) or warnings (yellow)
- **Frequency Tracking** - See first/last occurrence and total count for each pattern
- **Chart Integration** - Click a pattern to highlight its occurrences in the frequency chart

### API Errors Tracking
- **Endpoint Extraction** - Automatically identifies `/api/` endpoints from log messages
- **Method Detection** - Shows HTTP methods (GET, POST, PUT, DELETE) when available
- **Status Code Breakdown** - See which status codes are occurring for each endpoint
- **Error Prioritization** - Endpoints sorted by error count for quick identification

### AI-Powered Analysis
- **Claude Integration** - Send log patterns to Claude API for intelligent analysis
- **Root Cause Detection** - Get likely causes for top error patterns
- **Actionable Recommendations** - Receive specific suggestions to fix issues
- **Critical Issue Alerts** - Highlights issues needing immediate attention

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
git clone https://github.com/yourusername/App-Insights-Log-Analysis.git
cd App-Insights-Log-Analysis

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. Open http://localhost:5173 in your browser
2. Drag and drop a CSV file exported from Azure App Insights
3. Use the chart and filters to explore your logs
4. Click the **Patterns** tab to see grouped error patterns
5. Click the **API Errors** tab to analyze API endpoint issues
6. Click the **AI Analysis** tab and add your Anthropic API key for AI-powered insights

### Exporting from Azure App Insights

1. Go to your Application Insights resource in Azure Portal
2. Navigate to **Logs** (under Monitoring)
3. Run a query like:
   ```kusto
   traces
   | where timestamp > ago(24h)
   | project timestamp, severityLevel, message, customDimensions
   ```
4. Click **Export** → **Export to CSV**

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **AG Grid Community** - High-performance data grid
- **Recharts** - Charting library
- **Tailwind CSS** - Styling
- **PapaParse** - CSV parsing

## Performance

- Handles 50MB+ CSV files in the browser
- Virtual scrolling for smooth navigation of large datasets
- Memoized computations for responsive filtering
- No backend required - all processing happens client-side

## License

MIT
