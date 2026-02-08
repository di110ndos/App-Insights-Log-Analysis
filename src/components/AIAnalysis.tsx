import { useState, useCallback, useMemo } from 'react';
/// <reference types="vite/client" />
import { ErrorPattern, LogEntry } from '../types';
import {
  buildHealthContext,
  buildRootCauseContext,
  buildIncidentContext,
  buildAPIContext,
  buildRemediationContext,
  AnalysisStats,
} from '../utils/analysisContext';

interface AIAnalysisProps {
  patterns: ErrorPattern[];
  logs: LogEntry[];
  stats: {
    total: number;
    errors: number;
    warnings: number;
    timeRange: string;
  };
}

type AnalysisMode = 'health' | 'rootcause' | 'incident' | 'api' | 'remediation';

interface AnalysisSection {
  title: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  content: string;
  items?: string[];
  kql?: string;
  code?: string;
}

interface AnalysisResult {
  score?: number;
  summary: string;
  sections: AnalysisSection[];
}

const MODES: { id: AnalysisMode; label: string; icon: string; description: string }[] = [
  { id: 'health', label: 'Health Overview', icon: '\u2665', description: 'System health score and severity trends' },
  { id: 'rootcause', label: 'Root Cause', icon: '\u2295', description: 'Error chain analysis and dependency failures' },
  { id: 'incident', label: 'Incident Timeline', icon: '\u25F7', description: 'Chronological event reconstruction' },
  { id: 'api', label: 'API Health', icon: '\u26A1', description: 'Per-endpoint health scores and error rates' },
  { id: 'remediation', label: 'Remediation', icon: '\u2699', description: 'Fix recommendations with KQL queries' },
];

// Prompt templates per mode
function buildPrompt(mode: AnalysisMode, context: string): string {
  const baseInstruction = `You are an expert Azure cloud infrastructure analyst. Analyze the provided log data and return ONLY valid JSON matching the exact schema specified. No markdown, no explanation outside the JSON.`;

  const jsonSchema = `{
  "score": <number 0-100, optional, only for health mode>,
  "summary": "<2-3 sentence executive summary>",
  "sections": [
    {
      "title": "<section heading>",
      "severity": "<critical|high|medium|low|info>",
      "content": "<detailed paragraph explanation>",
      "items": ["<bullet point 1>", "<bullet point 2>"],
      "kql": "<optional KQL query to investigate this issue>",
      "code": "<optional config or code fix suggestion>"
    }
  ]
}`;

  switch (mode) {
    case 'health':
      return `${baseInstruction}

Provide a system health assessment with a health score (0-100, where 100 is healthy).

Include sections for:
1. "Health Score Breakdown" (severity: based on score - critical if <30, high if <50, medium if <70, low if <90, info if >=90) - explain the score
2. "Error Rate Analysis" (severity based on rate) - analyze the error rate trend
3. "Top Issues" (severity: high) - the most impactful problems
4. "Server Role Health" (severity based on findings) - per-role assessment (if role data available)
5. "Trend Assessment" (severity based on findings) - is it getting better or worse?

${context}

Return JSON matching this schema:
${jsonSchema}`;

    case 'rootcause':
      return `${baseInstruction}

Perform deep root cause analysis. Identify the underlying causes, not just symptoms.

Include sections for:
1. "Primary Root Cause" (severity: critical or high) - the most likely root cause with evidence
2. "Error Chain Analysis" (severity: high) - how errors cascade from root cause
3. "Dependency Failures" (severity based on findings) - external service/database/network issues
4. "Contributing Factors" (severity: medium) - secondary causes and conditions
5. "Verification Steps" (severity: info) - how to confirm the root cause, include KQL queries

For each section, include a KQL query that would help investigate in Azure Log Analytics.

${context}

Return JSON matching this schema:
${jsonSchema}`;

    case 'incident':
      return `${baseInstruction}

Reconstruct the incident timeline. Identify what happened, when, and in what order.

Include sections for:
1. "Incident Summary" (severity based on impact) - what happened in one paragraph
2. "Timeline of Events" (severity: info) - chronological sequence of significant events, use items[] for each event
3. "Spike Analysis" (severity: high if spikes found) - explain any error spikes
4. "Trigger Event" (severity: critical or high) - what likely triggered the incident
5. "Impact Window" (severity based on duration) - when did it start, peak, and resolve?
6. "Monitoring Recommendations" (severity: info) - KQL queries for alerts to catch this earlier

${context}

Return JSON matching this schema:
${jsonSchema}`;

    case 'api':
      return `${baseInstruction}

Provide a comprehensive API health report with per-endpoint analysis.

Include sections for:
1. "API Health Summary" (severity based on overall error rate) - overall API health assessment
2. "Critical Endpoints" (severity: critical) - endpoints with highest error rates, include specific fix suggestions
3. "Status Code Analysis" (severity based on 5xx rate) - breakdown of HTTP status codes and what they indicate
4. "Endpoint Recommendations" (severity: medium) - specific improvements per endpoint
5. "Monitoring Queries" (severity: info) - KQL queries for API health monitoring dashboards

For endpoints with errors, suggest specific fixes in the code field.

${context}

Return JSON matching this schema:
${jsonSchema}`;

    case 'remediation':
      return `${baseInstruction}

Create a prioritized remediation playbook with specific, actionable fixes.

Include sections for each major issue, prioritized by impact. For EACH section:
1. Explain the problem clearly
2. Provide the specific fix (in code field) - this could be Azure config, application code, or infrastructure changes
3. Provide a KQL query to monitor the fix (in kql field)
4. Estimate the impact of fixing it

Also include:
- "Quick Wins" (severity: medium) - easy fixes with high impact
- "Azure Configuration" (severity: high if needed) - App Service, App Insights, or infrastructure changes
- "Monitoring Setup" (severity: info) - KQL queries for ongoing monitoring of all identified issues

Be very specific. Don't say "fix the timeout" - say exactly what timeout setting to change and to what value.

${context}

Return JSON matching this schema:
${jsonSchema}`;
  }
}

export default function AIAnalysis({ patterns, logs, stats }: AIAnalysisProps) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [mode, setMode] = useState<AnalysisMode>('health');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [error, setError] = useState<string | null>(null);

  const analysisStats = useMemo<AnalysisStats>(() => ({
    total: stats.total,
    errors: stats.errors,
    warnings: stats.warnings,
    timeRange: stats.timeRange,
  }), [stats]);

  const analyze = useCallback(async () => {
    if (!apiKey) {
      setError('Missing API key. Add VITE_ANTHROPIC_API_KEY to your .env file and restart the dev server.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      // Build context based on mode
      let context: string;
      switch (mode) {
        case 'health': context = buildHealthContext(logs, patterns, analysisStats); break;
        case 'rootcause': context = buildRootCauseContext(logs, patterns, analysisStats); break;
        case 'incident': context = buildIncidentContext(logs, patterns, analysisStats); break;
        case 'api': context = buildAPIContext(logs, patterns, analysisStats); break;
        case 'remediation': context = buildRemediationContext(logs, patterns, analysisStats); break;
      }

      const prompt = buildPrompt(mode, context);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API request failed');
      }

      const data = await response.json();
      const content = data.content[0].text;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setResults(prev => ({ ...prev, [mode]: parsed }));
      } else {
        throw new Error('Failed to parse analysis response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [apiKey, mode, logs, patterns, analysisStats]);

  const currentResult = results[mode];

  // Severity styling helper
  const getSeverityStyle = (severity?: string) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-400', badge: 'bg-red-900/50 text-red-300' };
      case 'high': return { bg: 'bg-orange-900/20', border: 'border-orange-700', text: 'text-orange-400', badge: 'bg-orange-900/50 text-orange-300' };
      case 'medium': return { bg: 'bg-yellow-900/20', border: 'border-yellow-700', text: 'text-yellow-400', badge: 'bg-yellow-900/50 text-yellow-300' };
      case 'low': return { bg: 'bg-blue-900/20', border: 'border-blue-700', text: 'text-blue-400', badge: 'bg-blue-900/50 text-blue-300' };
      default: return { bg: 'bg-gray-800/50', border: 'border-gray-700', text: 'text-gray-400', badge: 'bg-gray-700 text-gray-300' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === m.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              <span className="mr-1.5">{m.icon}</span>
              {m.label}
              {results[m.id] && mode !== m.id && (
                <span className="ml-1.5 w-1.5 h-1.5 inline-block rounded-full bg-green-400"></span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 px-1">
          {MODES.find(m => m.id === mode)?.description}
        </p>
      </div>

      {/* Analysis Panel */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-300">
              {MODES.find(m => m.id === mode)?.label}
            </h3>
          </div>
          <button
            onClick={analyze}
            disabled={analyzing || patterns.length === 0}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
          >
            {analyzing ? 'Analyzing...' : currentResult ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>

        <div className="p-4">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Loading */}
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent mb-4"></div>
              <span className="text-gray-400 text-sm">Running {MODES.find(m => m.id === mode)?.label} analysis...</span>
              <span className="text-gray-500 text-xs mt-1">This may take 10-15 seconds</span>
            </div>
          )}

          {/* Results */}
          {currentResult && !analyzing && (
            <div className="space-y-4">
              {/* Health Score (only for health mode) */}
              {currentResult.score !== undefined && (
                <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
                  <div className={`text-4xl font-bold ${getScoreColor(currentResult.score)}`}>
                    {currentResult.score}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Health Score</div>
                    <div className="text-sm text-gray-300 mt-0.5">{currentResult.summary}</div>
                  </div>
                </div>
              )}

              {/* Summary (for non-health modes) */}
              {currentResult.score === undefined && (
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Summary</div>
                  <p className="text-sm text-gray-200">{currentResult.summary}</p>
                </div>
              )}

              {/* Sections */}
              {currentResult.sections.map((section, i) => {
                const style = getSeverityStyle(section.severity);
                return (
                  <div key={i} className={`rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      {section.severity && (
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${style.badge}`}>
                          {section.severity.toUpperCase()}
                        </span>
                      )}
                      <h4 className="text-sm font-medium text-gray-200">{section.title}</h4>
                    </div>

                    <div className="px-4 pb-3 space-y-2">
                      {section.content && (
                        <p className="text-sm text-gray-300 leading-relaxed">{section.content}</p>
                      )}

                      {section.items && section.items.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {section.items.map((item, j) => (
                            <li key={j} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className={`mt-1 ${style.text}`}>-</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.kql && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 font-medium">KQL Query</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(section.kql!)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="bg-gray-950 rounded p-3 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                            {section.kql}
                          </pre>
                        </div>
                      )}

                      {section.code && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 font-medium">Suggested Fix</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(section.code!)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="bg-gray-950 rounded p-3 text-xs text-blue-300 font-mono overflow-x-auto whitespace-pre-wrap">
                            {section.code}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!currentResult && !analyzing && !error && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Select an analysis mode above and click "Analyze" to get AI-powered insights.</p>
              <p className="text-xs mt-2">Each mode sends different context for deeper, focused analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
