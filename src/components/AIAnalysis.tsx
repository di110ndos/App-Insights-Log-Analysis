import { useState, useCallback } from 'react';
import { ErrorPattern, LogEntry } from '../types';

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

interface AnalysisResult {
  summary: string;
  rootCauses: string[];
  recommendations: string[];
  criticalIssues: string[];
}

export default function AIAnalysis({ patterns, logs, stats }: AIAnalysisProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem('anthropic_api_key', key);
    setShowKeyInput(false);
  }, []);

  const buildPrompt = useCallback(() => {
    const topErrors = patterns.filter(p => p.count >= 2).slice(0, 20);
    const recentErrors = logs.filter(l => l._severity >= 2).slice(0, 10);

    return `Analyze these Azure Application Insights logs and provide actionable insights.

## Log Summary
- Total entries: ${stats.total}
- Errors: ${stats.errors}
- Warnings: ${stats.warnings}
- Time range: ${stats.timeRange}

## Top Error Patterns (grouped by similarity)
${topErrors.map((p, i) => `${i + 1}. [${p.count}x] ${p.message}`).join('\n')}

## Recent Error Samples
${recentErrors.map(l => `- [${l._severity === 3 ? 'ERROR' : 'WARN'}] ${l._message.substring(0, 200)}`).join('\n')}

Please provide:
1. A brief summary of the overall health and main issues
2. Likely root causes for the top errors
3. Specific recommendations to fix or mitigate these issues
4. Any critical issues that need immediate attention

Format your response as JSON with these fields:
{
  "summary": "overall assessment",
  "rootCauses": ["cause1", "cause2"],
  "recommendations": ["rec1", "rec2"],
  "criticalIssues": ["issue1"]
}`;
  }, [patterns, logs, stats]);

  const analyze = useCallback(async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
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
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: buildPrompt()
          }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API request failed');
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setResult(parsed);
      } else {
        setResult({
          summary: content,
          rootCauses: [],
          recommendations: [],
          criticalIssues: []
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [apiKey, buildPrompt]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-300">AI Log Analysis</h3>
        </div>
        <div className="flex items-center gap-2">
          {apiKey && !showKeyInput && (
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              Change API Key
            </button>
          )}
          <button
            onClick={analyze}
            disabled={analyzing || patterns.length === 0}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Analyze with Claude'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* API Key Input */}
        {showKeyInput && (
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400 mb-2">
              Enter your Anthropic API key to enable AI analysis. Your key is stored locally.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500"
              />
              <button
                onClick={() => saveApiKey(apiKey)}
                disabled={!apiKey.startsWith('sk-')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-medium rounded"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {analyzing && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent mr-3"></div>
            <span className="text-gray-400">Analyzing log patterns...</span>
          </div>
        )}

        {/* Results */}
        {result && !analyzing && (
          <div className="space-y-4">
            {/* Summary */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
              <p className="text-sm text-gray-200">{result.summary}</p>
            </div>

            {/* Critical Issues */}
            {result.criticalIssues.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-500 uppercase tracking-wider mb-2">Critical Issues</h4>
                <ul className="space-y-1">
                  {result.criticalIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">!</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Root Causes */}
            {result.rootCauses.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-yellow-500 uppercase tracking-wider mb-2">Likely Root Causes</h4>
                <ul className="space-y-1">
                  {result.rootCauses.map((cause, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">{i + 1}.</span>
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-green-500 uppercase tracking-wider mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !analyzing && !error && (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">Click "Analyze with Claude" to get AI-powered insights about your logs.</p>
            <p className="text-xs mt-1">Requires an Anthropic API key.</p>
          </div>
        )}
      </div>
    </div>
  );
}
