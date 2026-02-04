import { ComparisonResult } from '../types';

interface FileComparisonProps {
  result: ComparisonResult;
  file1Name: string;
  file2Name: string;
}

export default function FileComparison({ result, file1Name, file2Name }: FileComparisonProps) {
  const { summary, file1Only, file2Only, bothFiles } = result;

  const errorDiff = summary.file2Errors - summary.file1Errors;
  const warningDiff = summary.file2Warnings - summary.file1Warnings;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Error Change</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${errorDiff > 0 ? 'text-red-400' : errorDiff < 0 ? 'text-green-400' : 'text-gray-400'}`}>
              {errorDiff > 0 ? '+' : ''}{errorDiff}
            </span>
            <span className="text-xs text-gray-500">
              {summary.file1Errors} → {summary.file2Errors}
            </span>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Warning Change</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${warningDiff > 0 ? 'text-yellow-400' : warningDiff < 0 ? 'text-green-400' : 'text-gray-400'}`}>
              {warningDiff > 0 ? '+' : ''}{warningDiff}
            </span>
            <span className="text-xs text-gray-500">
              {summary.file1Warnings} → {summary.file2Warnings}
            </span>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">New Patterns</div>
          <div className="text-2xl font-bold text-red-400">{summary.newPatterns}</div>
          <div className="text-xs text-gray-500">errors appearing in {file2Name}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Resolved Patterns</div>
          <div className="text-2xl font-bold text-green-400">{summary.resolvedPatterns}</div>
          <div className="text-xs text-gray-500">errors fixed since {file1Name}</div>
        </div>
      </div>

      {/* New Errors Section */}
      {file2Only.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-red-900/20">
            <h3 className="text-sm font-medium text-red-400">
              New Errors in {file2Name} ({file2Only.length})
            </h3>
            <p className="text-xs text-gray-500 mt-1">These errors appear in the new file but not in the baseline</p>
          </div>
          <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
            {file2Only.map((pattern, i) => (
              <div key={i} className="p-3 hover:bg-gray-800/30">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-200 font-mono flex-1">{pattern.message}</p>
                  <span className="text-red-400 font-bold">{pattern.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Errors Section */}
      {file1Only.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-green-900/20">
            <h3 className="text-sm font-medium text-green-400">
              Resolved Errors ({file1Only.length})
            </h3>
            <p className="text-xs text-gray-500 mt-1">These errors were in {file1Name} but are no longer present</p>
          </div>
          <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
            {file1Only.map((pattern, i) => (
              <div key={i} className="p-3 hover:bg-gray-800/30">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-200 font-mono flex-1">{pattern.message}</p>
                  <span className="text-gray-500 line-through">{pattern.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changed Patterns Section */}
      {bothFiles.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">
              Changed Patterns ({bothFiles.length})
            </h3>
            <p className="text-xs text-gray-500 mt-1">Errors present in both files with frequency changes</p>
          </div>
          <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
            {bothFiles.map((item, i) => {
              const changeColor = item.change > 10 ? 'text-red-400' : item.change < -10 ? 'text-green-400' : 'text-gray-400';
              const changeBg = item.change > 10 ? 'bg-red-900/10' : item.change < -10 ? 'bg-green-900/10' : '';

              return (
                <div key={i} className={`p-3 hover:bg-gray-800/30 ${changeBg}`}>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-gray-200 font-mono flex-1">{item.pattern.message}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">{item.file1Count}</span>
                      <span className="text-gray-600">→</span>
                      <span className={changeColor}>{item.file2Count}</span>
                      <span className={`text-xs ${changeColor}`}>
                        ({item.change > 0 ? '+' : ''}{item.change.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {file2Only.length === 0 && file1Only.length === 0 && bothFiles.length === 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
          <div className="text-gray-500">No significant differences found between files</div>
        </div>
      )}
    </div>
  );
}
