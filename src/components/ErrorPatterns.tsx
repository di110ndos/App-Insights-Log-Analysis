import { ErrorPattern, LogEntry } from '../types';

interface ErrorPatternsProps {
  patterns: ErrorPattern[];
  logs: LogEntry[];
  onPatternClick: (pattern: ErrorPattern) => void;
  onViewDetails: (log: LogEntry) => void;
  selectedPattern: ErrorPattern | null;
}

export default function ErrorPatterns({ patterns, logs, onPatternClick, onViewDetails, selectedPattern }: ErrorPatternsProps) {
  // Create a map for quick log lookup
  const logMap = new Map(logs.map(l => [l._id, l]));
  if (patterns.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
        <div className="text-gray-500">No patterns found</div>
      </div>
    );
  }

  const maxCount = Math.max(...patterns.map(p => p.count));

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Grouped Patterns
        </h3>
        <div className="flex items-center gap-4">
          {selectedPattern && (
            <span className="text-xs text-purple-400">
              1 pattern selected - click to view in chart & grid
            </span>
          )}
          <span className="text-xs text-gray-500">
            {patterns.length} unique patterns
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto">
        {patterns.map((pattern, index) => {
          const barWidth = (pattern.count / maxCount) * 100;
          const isSelected = selectedPattern?.normalized === pattern.normalized;
          const isError = pattern.severity === 3;

          // Colors based on severity
          const barColor = isSelected ? 'bg-purple-900/30' : isError ? 'bg-red-900/20' : 'bg-yellow-900/20';
          const countColor = isSelected ? 'text-purple-400' : isError ? 'text-red-400' : 'text-yellow-400';
          const badgeColor = isError ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-yellow-900/50 text-yellow-300 border-yellow-700';

          return (
            <div
              key={index}
              onClick={() => onPatternClick(pattern)}
              className={`p-4 cursor-pointer transition-colors relative ${
                isSelected
                  ? 'bg-purple-900/30 hover:bg-purple-900/40'
                  : 'hover:bg-gray-800/50'
              }`}
            >
              {/* Background bar */}
              <div
                className={`absolute inset-y-0 left-0 ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isSelected && (
                        <span className="inline-block px-2 py-0.5 bg-purple-600 text-purple-100 text-xs rounded">
                          Selected
                        </span>
                      )}
                      <span className={`inline-block px-2 py-0.5 text-xs rounded border ${badgeColor}`}>
                        {isError ? 'Error' : 'Warning'}
                      </span>
                      {pattern.errorCount > 0 && pattern.warningCount > 0 && (
                        <span className="text-xs text-gray-500">
                          ({pattern.errorCount} errors, {pattern.warningCount} warnings)
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-mono ${isSelected ? 'text-purple-200' : 'text-gray-200'}`}>
                      {pattern.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className={`text-lg font-bold ${countColor}`}>
                      {pattern.count.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      First: {pattern.firstSeen.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                    <span>
                      Last: {pattern.lastSeen.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span>{isSelected ? 'Click again to deselect' : 'Click to filter & view in chart'}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const sampleLog = logMap.get(pattern.ids[0]);
                      if (sampleLog) onViewDetails(sampleLog);
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
