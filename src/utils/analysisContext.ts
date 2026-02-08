import { LogEntry, ErrorPattern } from '../types';
import { getSeverityLabel } from './csvParser';

export interface AnalysisStats {
  total: number;
  errors: number;
  warnings: number;
  critical?: number;
  timeRange: string;
  filtered?: number;
}

// Extract API endpoint from log message (copied from APIErrors.tsx)
function extractAPIEndpoint(message: string): { endpoint: string; method: string | null } | null {
  const patterns = [
    // Method + endpoint: "GET /api/users" or "POST https://example.com/api/users"
    /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(?:https?:\/\/[^/\s]+)?(\/api\/[^\s?#"'\]}]+)/i,
    // Just endpoint with /api/
    /(?:https?:\/\/[^/\s]+)?(\/api\/[^\s?#"'\]},]+)/i,
    // URL in quotes or after common patterns
    /["'](?:https?:\/\/[^/\s]+)?(\/api\/[^"'\s?#]+)["']/i,
    // "endpoint": "/api/..."
    /endpoint["']?\s*[:=]\s*["']?(\/api\/[^\s"',}]+)/i,
    // url: "/api/..." or path: "/api/..."
    /(?:url|path|uri)["']?\s*[:=]\s*["']?(?:https?:\/\/[^/\s]+)?(\/api\/[^\s"',}]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      let endpoint = match[match.length - 1] || match[1];
      let method: string | null = null;

      // Check if we captured a method
      if (match[1] && /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/i.test(match[1])) {
        method = match[1].toUpperCase();
        endpoint = match[2];
      }

      // Normalize: replace UUIDs, numeric IDs with placeholders
      endpoint = endpoint
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
        .replace(/\/\d+(?=\/|$)/g, '/{id}')
        .replace(/\/$/, ''); // Remove trailing slash

      return { endpoint, method };
    }
  }

  return null;
}

// Extract status code from message (copied from APIErrors.tsx)
function extractStatusCode(message: string): string | null {
  const patterns = [
    /\bstatus(?:Code)?["']?\s*[:=]\s*["']?(\d{3})/i,
    /\bHTTP\s*(\d{3})/i,
    /\breturned?\s+(\d{3})/i,
    /\b(\d{3})\s+(?:error|internal|not found|bad request|unauthorized|forbidden)/i,
    /\bcode["']?\s*[:=]\s*["']?(\d{3})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Mode 1: Health Overview
 * Provides: severity distribution, error rate, top patterns, server role breakdown, time distribution
 */
export function buildHealthContext(logs: LogEntry[], patterns: ErrorPattern[], stats: AnalysisStats): string {
  const errorRate = stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : '0';
  const warningRate = stats.total > 0 ? ((stats.warnings / stats.total) * 100).toFixed(1) : '0';

  // Severity distribution
  const sevCounts = [0, 0, 0, 0, 0];
  logs.forEach(l => { if (l._severity >= 0 && l._severity <= 4) sevCounts[l._severity]++; });

  // Server role distribution
  const roles = new Map<string, { total: number; errors: number; warnings: number }>();
  logs.forEach(l => {
    const role = l._serverRole || 'Unknown';
    if (!roles.has(role)) roles.set(role, { total: 0, errors: 0, warnings: 0 });
    const r = roles.get(role)!;
    r.total++;
    if (l._severity === 3) r.errors++;
    if (l._severity === 2) r.warnings++;
  });

  // Time distribution - divide into 6 buckets to show trends
  const withTime = logs.filter(l => l._timestamp).sort((a, b) => a._timestamp!.getTime() - b._timestamp!.getTime());
  let timeDistribution = '';
  if (withTime.length > 0) {
    const start = withTime[0]._timestamp!.getTime();
    const end = withTime[withTime.length - 1]._timestamp!.getTime();
    const bucketSize = Math.max((end - start) / 6, 1);
    const buckets: { time: string; errors: number; warnings: number; total: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const bStart = start + i * bucketSize;
      const bEnd = bStart + bucketSize;
      const inBucket = withTime.filter(l => {
        const ts = l._timestamp!.getTime();
        return ts >= bStart && ts < bEnd;
      });
      buckets.push({
        time: new Date(bStart).toISOString().substring(11, 16),
        errors: inBucket.filter(l => l._severity >= 3).length,
        warnings: inBucket.filter(l => l._severity === 2).length,
        total: inBucket.length
      });
    }
    timeDistribution = buckets.map(b => `  ${b.time}: ${b.total} total, ${b.errors} errors, ${b.warnings} warnings`).join('\n');
  }

  // Top patterns
  const topPatterns = patterns.slice(0, 15).map((p, i) =>
    `${i + 1}. [${p.count}x] [${getSeverityLabel(p.severity)}] ${p.message}`
  ).join('\n');

  // Role summary
  const roleSummary = Array.from(roles.entries()).map(([role, data]) =>
    `  ${role}: ${data.total} total, ${data.errors} errors, ${data.warnings} warnings`
  ).join('\n');

  return `## System Overview
- Total log entries: ${stats.total}
- Error rate: ${errorRate}% (${stats.errors} errors)
- Warning rate: ${warningRate}% (${stats.warnings} warnings)
- Critical entries: ${sevCounts[4]}
- Time range: ${stats.timeRange}

## Severity Distribution
- Critical (4): ${sevCounts[4]}
- Error (3): ${sevCounts[3]}
- Warning (2): ${sevCounts[2]}
- Info (1): ${sevCounts[1]}
- Verbose (0): ${sevCounts[0]}

## Time Distribution (error trend)
${timeDistribution || 'No timestamp data available'}

## Server Role Breakdown
${roleSummary || 'No server role data available'}

## Top ${Math.min(15, patterns.length)} Error/Warning Patterns
${topPatterns || 'No patterns detected'}`;
}

/**
 * Mode 2: Root Cause Analysis
 * Provides: error chains, co-occurring errors, dependency failures, temporal correlation
 */
export function buildRootCauseContext(logs: LogEntry[], patterns: ErrorPattern[], stats: AnalysisStats): string {
  // Find errors that co-occur within 1-minute windows
  const errorLogs = logs.filter(l => l._severity >= 2 && l._timestamp);

  // Group errors into 1-minute buckets to find co-occurrence
  const minuteBuckets = new Map<number, LogEntry[]>();
  errorLogs.forEach(l => {
    const bucket = Math.floor(l._timestamp!.getTime() / 60000);
    if (!minuteBuckets.has(bucket)) minuteBuckets.set(bucket, []);
    minuteBuckets.get(bucket)!.push(l);
  });

  // Find buckets with multiple different error types (potential chains)
  const coOccurrences: string[] = [];
  minuteBuckets.forEach((entries) => {
    if (entries.length >= 2) {
      const uniqueMessages = [...new Set(entries.map(e => e._message.substring(0, 100)))];
      if (uniqueMessages.length >= 2) {
        coOccurrences.push(uniqueMessages.slice(0, 4).map(m => `    - ${m}`).join('\n'));
      }
    }
  });

  // Categorize errors by type
  const categories = {
    timeout: [] as string[],
    connection: [] as string[],
    database: [] as string[],
    authentication: [] as string[],
    nullReference: [] as string[],
    http: [] as string[],
    other: [] as string[]
  };

  patterns.slice(0, 30).forEach(p => {
    const msg = p.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) categories.timeout.push(`[${p.count}x] ${p.message}`);
    else if (msg.includes('connection') || msg.includes('socket') || msg.includes('dns')) categories.connection.push(`[${p.count}x] ${p.message}`);
    else if (msg.includes('sql') || msg.includes('database') || msg.includes('db ') || msg.includes('query')) categories.database.push(`[${p.count}x] ${p.message}`);
    else if (msg.includes('auth') || msg.includes('token') || msg.includes('credential') || msg.includes('permission') || msg.includes('403') || msg.includes('401')) categories.authentication.push(`[${p.count}x] ${p.message}`);
    else if (msg.includes('null') || msg.includes('undefined') || msg.includes('reference')) categories.nullReference.push(`[${p.count}x] ${p.message}`);
    else if (msg.includes('http') || msg.includes('status') || msg.includes('request failed') || msg.includes('500') || msg.includes('404')) categories.http.push(`[${p.count}x] ${p.message}`);
    else categories.other.push(`[${p.count}x] ${p.message}`);
  });

  const categoryText = Object.entries(categories)
    .filter(([, items]) => items.length > 0)
    .map(([cat, items]) => `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} Errors (${items.length})\n${items.slice(0, 5).join('\n')}`)
    .join('\n\n');

  // Sample full error messages for top 5 patterns
  const detailedSamples = patterns.slice(0, 5).map((p, i) => {
    const sampleLogs = logs.filter(l => p.ids.includes(l._id)).slice(0, 2);
    const samples = sampleLogs.map(l => `  Full message: ${l._message.substring(0, 300)}`).join('\n');
    return `${i + 1}. Pattern: "${p.message}" (${p.count} occurrences, ${p.errorCount} errors, ${p.warningCount} warnings)\n${samples}`;
  }).join('\n\n');

  return `## Error Summary
- Total errors: ${stats.errors}
- Total warnings: ${stats.warnings}
- Unique error patterns: ${patterns.length}
- Time range: ${stats.timeRange}

## Error Categories
${categoryText}

## Co-Occurring Errors (within 1-minute windows)
Found ${coOccurrences.length} time windows with multiple error types:
${coOccurrences.slice(0, 10).map((c, i) => `  Window ${i + 1}:\n${c}`).join('\n') || '  No co-occurring errors detected'}

## Detailed Error Samples (Top 5 Patterns)
${detailedSamples}`;
}

/**
 * Mode 3: Incident Timeline
 * Provides: chronological event sequence, spike detection, first occurrences
 */
export function buildIncidentContext(logs: LogEntry[], patterns: ErrorPattern[], stats: AnalysisStats): string {
  const withTime = logs.filter(l => l._timestamp).sort((a, b) => a._timestamp!.getTime() - b._timestamp!.getTime());
  if (withTime.length === 0) return 'No timestamp data available for timeline analysis.';

  const start = withTime[0]._timestamp!.getTime();
  const end = withTime[withTime.length - 1]._timestamp!.getTime();
  const totalMinutes = (end - start) / 60000;

  // Create 5-minute buckets for spike detection
  const bucketSize = Math.max(5 * 60000, (end - start) / 30); // 5 min or 1/30th of range
  const buckets: { time: string; total: number; errors: number; warnings: number; critical: number }[] = [];

  for (let t = start; t < end; t += bucketSize) {
    const inBucket = withTime.filter(l => {
      const ts = l._timestamp!.getTime();
      return ts >= t && ts < t + bucketSize;
    });
    if (inBucket.length > 0) {
      buckets.push({
        time: new Date(t).toISOString().replace('T', ' ').substring(0, 19),
        total: inBucket.length,
        errors: inBucket.filter(l => l._severity === 3).length,
        warnings: inBucket.filter(l => l._severity === 2).length,
        critical: inBucket.filter(l => l._severity === 4).length,
      });
    }
  }

  // Detect spikes (buckets with error count > 2x average)
  const avgErrors = buckets.reduce((sum, b) => sum + b.errors, 0) / Math.max(buckets.length, 1);
  const spikes = buckets.filter(b => b.errors > avgErrors * 2 && b.errors > 2);

  // First occurrence of each pattern
  const firstOccurrences = patterns.slice(0, 15).map(p => {
    return `  ${p.firstSeen.toISOString().replace('T', ' ').substring(0, 19)} - [${getSeverityLabel(p.severity)}] ${p.message} (${p.count} total occurrences)`;
  }).join('\n');

  // Chronological event sequence (errors and warnings only, sampled)
  const errorEvents = withTime.filter(l => l._severity >= 2);
  const sampledEvents = errorEvents.length > 50
    ? errorEvents.filter((_, i) => i % Math.ceil(errorEvents.length / 50) === 0)
    : errorEvents;
  const timeline = sampledEvents.slice(0, 50).map(l => {
    const role = l._serverRole ? `[${l._serverRole}]` : '';
    return `  ${l._timestamp!.toISOString().replace('T', ' ').substring(0, 19)} ${role} [${getSeverityLabel(l._severity)}] ${l._message.substring(0, 150)}`;
  }).join('\n');

  // Timeline buckets for display
  const timelineTable = buckets.map(b =>
    `  ${b.time} | Total: ${b.total.toString().padStart(5)} | Errors: ${b.errors.toString().padStart(4)} | Warnings: ${b.warnings.toString().padStart(4)}${b.critical > 0 ? ` | CRITICAL: ${b.critical}` : ''}`
  ).join('\n');

  return `## Incident Overview
- Time range: ${stats.timeRange}
- Duration: ${totalMinutes.toFixed(0)} minutes
- Total events: ${stats.total}
- Total errors: ${stats.errors}
- Total warnings: ${stats.warnings}

## Time Buckets (error frequency)
${timelineTable}

## Detected Spikes (>${(avgErrors * 2).toFixed(0)} errors, avg is ${avgErrors.toFixed(1)})
${spikes.length > 0 ? spikes.map(s => `  SPIKE at ${s.time}: ${s.errors} errors, ${s.warnings} warnings, ${s.total} total`).join('\n') : '  No significant spikes detected'}

## First Occurrence of Each Error Pattern
${firstOccurrences}

## Chronological Event Sequence (errors/warnings, sampled)
${timeline}`;
}

/**
 * Mode 4: API Health Report
 * Provides: per-endpoint stats, status codes, error rates, method breakdown
 */
export function buildAPIContext(logs: LogEntry[], _patterns: ErrorPattern[], stats: AnalysisStats): string {
  interface EndpointData {
    endpoint: string;
    method: string | null;
    total: number;
    errors: number;
    warnings: number;
    statusCodes: Map<string, number>;
    sampleMessages: string[];
  }

  const endpoints = new Map<string, EndpointData>();

  logs.forEach(l => {
    const extracted = extractAPIEndpoint(l._message);
    if (!extracted) return;

    const { endpoint, method } = extracted;
    const key = `${method || 'ANY'} ${endpoint}`;

    if (!endpoints.has(key)) {
      endpoints.set(key, {
        endpoint,
        method,
        total: 0,
        errors: 0,
        warnings: 0,
        statusCodes: new Map(),
        sampleMessages: []
      });
    }

    const ep = endpoints.get(key)!;
    ep.total++;
    if (l._severity === 3) ep.errors++;
    if (l._severity === 2) ep.warnings++;

    const statusCode = extractStatusCode(l._message);
    if (statusCode) {
      ep.statusCodes.set(statusCode, (ep.statusCodes.get(statusCode) || 0) + 1);
    }

    if (ep.sampleMessages.length < 3) {
      ep.sampleMessages.push(l._message.substring(0, 200));
    }
  });

  const sorted = Array.from(endpoints.values()).sort((a, b) => b.errors - a.errors || b.total - a.total);

  if (sorted.length === 0) {
    return `## API Health Report
No API endpoints (matching /api/ pattern) were detected in the logs.

Total logs analyzed: ${stats.total}`;
  }

  const totalAPILogs = sorted.reduce((sum, ep) => sum + ep.total, 0);
  const totalAPIErrors = sorted.reduce((sum, ep) => sum + ep.errors, 0);

  const endpointDetails = sorted.slice(0, 20).map((ep, i) => {
    const errorRate = ep.total > 0 ? ((ep.errors / ep.total) * 100).toFixed(1) : '0';
    const statusStr = Array.from(ep.statusCodes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `${code}:${count}`)
      .join(', ');
    const samples = ep.sampleMessages.map(m => `    Sample: ${m}`).join('\n');

    return `${i + 1}. ${ep.method || 'ANY'} ${ep.endpoint}
   Total: ${ep.total} | Errors: ${ep.errors} (${errorRate}%) | Warnings: ${ep.warnings}
   Status codes: ${statusStr || 'none detected'}
${samples}`;
  }).join('\n\n');

  return `## API Health Summary
- Total API log entries: ${totalAPILogs}
- Total API errors: ${totalAPIErrors}
- API error rate: ${totalAPILogs > 0 ? ((totalAPIErrors / totalAPILogs) * 100).toFixed(1) : '0'}%
- Unique endpoints: ${sorted.length}

## Endpoint Details (sorted by error count)
${endpointDetails}`;
}

/**
 * Mode 5: Remediation Playbook
 * Provides: top errors with full context, Azure-specific info, suggested KQL queries
 */
export function buildRemediationContext(logs: LogEntry[], patterns: ErrorPattern[], stats: AnalysisStats): string {
  // Detailed info for top 10 patterns
  const detailedPatterns = patterns.slice(0, 10).map((p, i) => {
    const sampleLogs = logs.filter(l => p.ids.includes(l._id)).slice(0, 3);

    // Extract any raw fields that might be useful
    const rawFields = sampleLogs.map(l => {
      const useful: Record<string, string> = {};
      Object.entries(l._raw).forEach(([key, value]) => {
        const k = key.toLowerCase();
        if (k.includes('exception') || k.includes('stack') || k.includes('error') ||
            k.includes('operation') || k.includes('dependency') || k.includes('result') ||
            k.includes('cloud_role') || k.includes('itemtype')) {
          useful[key] = String(value).substring(0, 200);
        }
      });
      return useful;
    });

    const rawFieldsStr = rawFields.filter(r => Object.keys(r).length > 0).map(r =>
      Object.entries(r).map(([k, v]) => `      ${k}: ${v}`).join('\n')
    ).join('\n    ---\n');

    const roleBreakdown = new Map<string, number>();
    sampleLogs.forEach(l => {
      const role = l._serverRole || 'Unknown';
      roleBreakdown.set(role, (roleBreakdown.get(role) || 0) + 1);
    });

    const fullMessages = sampleLogs.map(l => `    "${l._message.substring(0, 400)}"`).join('\n');

    return `### Pattern ${i + 1}: ${p.message}
- Occurrences: ${p.count} (${p.errorCount} errors, ${p.warningCount} warnings)
- Severity: ${getSeverityLabel(p.severity)}
- First seen: ${p.firstSeen.toISOString().replace('T', ' ').substring(0, 19)}
- Last seen: ${p.lastSeen.toISOString().replace('T', ' ').substring(0, 19)}
- Duration: ${((p.lastSeen.getTime() - p.firstSeen.getTime()) / 60000).toFixed(0)} minutes
- Server roles: ${Array.from(roleBreakdown.entries()).map(([r, c]) => `${r}(${c})`).join(', ') || 'N/A'}
- Full sample messages:
${fullMessages}
${rawFieldsStr ? `- Additional context:\n${rawFieldsStr}` : ''}`;
  }).join('\n\n');

  return `## Remediation Context
- Total errors: ${stats.errors}
- Total warnings: ${stats.warnings}
- Unique patterns: ${patterns.length}
- Time range: ${stats.timeRange}
- These are Azure Application Insights trace logs exported as CSV

## Top ${Math.min(10, patterns.length)} Error Patterns (Full Detail)
${detailedPatterns}

## Azure Environment Info
${logs[0]?._serverRole ? `Server roles detected: ${[...new Set(logs.filter(l => l._serverRole).map(l => l._serverRole!))].join(', ')}` : 'No server role information available'}`;
}
