import { useMemo } from 'react';
import { LogEntry } from '../types';

interface APIErrorsProps {
  logs: LogEntry[];
  onViewDetails: (log: LogEntry) => void;
  onEndpointClick: (endpoint: string, logIds: number[]) => void;
}

interface APIEndpoint {
  endpoint: string;
  method: string | null;
  totalCount: number;
  errorCount: number;
  warningCount: number;
  statusCodes: Map<string, number>;
  firstSeen: Date;
  lastSeen: Date;
  sampleLogs: LogEntry[];
  allLogIds: number[];
}

// Extract API endpoint from message
function extractAPIEndpoint(message: string): { endpoint: string; method: string | null } | null {
  // Match patterns like "GET /api/users", "POST /api/orders/123", "/api/health"
  // Also match full URLs like "https://example.com/api/users"

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
      // Normalize the endpoint - remove IDs/GUIDs
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

// Extract status code from message
function extractStatusCode(message: string): string | null {
  // Match patterns like "status: 500", "statusCode: 404", "HTTP 500", "returned 404"
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

export default function APIErrors({ logs, onViewDetails, onEndpointClick }: APIErrorsProps) {
  const apiEndpoints = useMemo(() => {
    const endpoints = new Map<string, APIEndpoint>();

    logs.forEach(log => {
      const extracted = extractAPIEndpoint(log._message);
      if (!extracted) return;

      const key = `${extracted.method || 'ANY'} ${extracted.endpoint}`;
      const statusCode = extractStatusCode(log._message);

      if (!endpoints.has(key)) {
        endpoints.set(key, {
          endpoint: extracted.endpoint,
          method: extracted.method,
          totalCount: 0,
          errorCount: 0,
          warningCount: 0,
          statusCodes: new Map(),
          firstSeen: log._timestamp || new Date(),
          lastSeen: log._timestamp || new Date(),
          sampleLogs: [],
          allLogIds: []
        });
      }

      const ep = endpoints.get(key)!;
      ep.totalCount++;
      ep.allLogIds.push(log._id);

      if (log._severity === 3) ep.errorCount++;
      if (log._severity === 2) ep.warningCount++;

      if (statusCode) {
        ep.statusCodes.set(statusCode, (ep.statusCodes.get(statusCode) || 0) + 1);
      }

      if (log._timestamp) {
        if (log._timestamp < ep.firstSeen) ep.firstSeen = log._timestamp;
        if (log._timestamp > ep.lastSeen) ep.lastSeen = log._timestamp;
      }

      if (ep.sampleLogs.length < 5) {
        ep.sampleLogs.push(log);
      }
    });

    // Sort by error count (highest first)
    return Array.from(endpoints.values())
      .sort((a, b) => b.errorCount - a.errorCount || b.totalCount - a.totalCount);
  }, [logs]);

  const totalAPIErrors = apiEndpoints.reduce((sum, ep) => sum + ep.errorCount, 0);
  const totalAPIWarnings = apiEndpoints.reduce((sum, ep) => sum + ep.warningCount, 0);

  if (apiEndpoints.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
        <div className="text-gray-500">No API endpoint patterns found in logs</div>
        <p className="text-xs text-gray-600 mt-2">
          Looking for patterns like "/api/users", "GET /api/orders", etc.
        </p>
      </div>
    );
  }

  const maxErrors = Math.max(...apiEndpoints.map(ep => ep.errorCount));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">API Endpoints</div>
          <div className="text-2xl font-bold text-gray-100">{apiEndpoints.length}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total API Logs</div>
          <div className="text-2xl font-bold text-blue-400">
            {apiEndpoints.reduce((sum, ep) => sum + ep.totalCount, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">API Errors</div>
          <div className="text-2xl font-bold text-red-400">{totalAPIErrors.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">API Warnings</div>
          <div className="text-2xl font-bold text-yellow-400">{totalAPIWarnings.toLocaleString()}</div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">
            API Endpoints by Error Count
          </h3>
          <span className="text-xs text-gray-500">
            Click to filter logs by endpoint
          </span>
        </div>

        <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
          {apiEndpoints.map((ep, index) => {
            const barWidth = maxErrors > 0 ? (ep.errorCount / maxErrors) * 100 : 0;
            const statusCodesArr = Array.from(ep.statusCodes.entries())
              .sort((a, b) => b[1] - a[1]);

            return (
              <div
                key={index}
                className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors relative"
                onClick={() => onEndpointClick(ep.endpoint, ep.allLogIds)}
              >
                {/* Background bar for errors */}
                {ep.errorCount > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-red-900/20"
                    style={{ width: `${barWidth}%` }}
                  />
                )}

                <div className="relative">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {ep.method && (
                          <span className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                            ep.method === 'GET' ? 'bg-green-900/50 text-green-400' :
                            ep.method === 'POST' ? 'bg-blue-900/50 text-blue-400' :
                            ep.method === 'PUT' ? 'bg-yellow-900/50 text-yellow-400' :
                            ep.method === 'DELETE' ? 'bg-red-900/50 text-red-400' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {ep.method}
                          </span>
                        )}
                        <code className="text-sm text-gray-200 font-mono">
                          {ep.endpoint}
                        </code>
                      </div>

                      {/* Status codes */}
                      {statusCodesArr.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {statusCodesArr.slice(0, 5).map(([code, count]) => (
                            <span
                              key={code}
                              className={`px-1.5 py-0.5 text-xs rounded ${
                                code.startsWith('5') ? 'bg-red-900/40 text-red-400' :
                                code.startsWith('4') ? 'bg-yellow-900/40 text-yellow-400' :
                                'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {code}: {count}
                            </span>
                          ))}
                          {statusCodesArr.length > 5 && (
                            <span className="text-xs text-gray-500">+{statusCodesArr.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {ep.errorCount > 0 && (
                            <span className="text-red-400 font-bold">{ep.errorCount}</span>
                          )}
                          {ep.warningCount > 0 && (
                            <span className="text-yellow-400">{ep.warningCount}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{ep.totalCount} total</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ep.sampleLogs[0]) onViewDetails(ep.sampleLogs[0]);
                        }}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      First: {ep.firstSeen.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                    <span>
                      Last: {ep.lastSeen.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
