import { LogEntry } from '../types';
import { getSeverityLabel, getSeverityColor } from '../utils/csvParser';

interface DetailDrawerProps {
  log: LogEntry | null;
  onClose: () => void;
}

export default function DetailDrawer({ log, onClose }: DetailDrawerProps) {
  if (!log) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const isJson = (str: string): boolean => {
    if (typeof str !== 'string') return false;
    try {
      const parsed = JSON.parse(str);
      return typeof parsed === 'object';
    } catch {
      return false;
    }
  };

  const formatJsonString = (str: string): string => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  // Organize entries into groups
  const coreFields = ['_timestamp', '_severity', '_message'];
  const rawEntries = Object.entries(log._raw || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[700px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-900/95">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-100">Log Details</h2>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${getSeverityColor(log._severity)}20`,
                color: getSeverityColor(log._severity),
                border: `1px solid ${getSeverityColor(log._severity)}40`
              }}
            >
              {getSeverityLabel(log._severity)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Timestamp */}
          {log._timestamp && (
            <div className="mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Timestamp</div>
              <div className="font-mono text-gray-200">
                {log._timestamp.toLocaleString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </div>
            </div>
          )}

          {/* Message */}
          {log._message && (
            <div className="mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Message</div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono break-words">
                  {log._message}
                </pre>
              </div>
            </div>
          )}

          {/* All Fields */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">All Fields</div>
            <div className="space-y-3">
              {rawEntries.map(([key, value]) => {
                const strValue = formatValue(value);
                const hasJson = isJson(strValue);

                return (
                  <div key={key} className="border-b border-gray-800 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-medium text-gray-400 flex-shrink-0">{key}</span>
                      {strValue.length < 80 && !hasJson ? (
                        <span className="text-sm text-gray-200 font-mono text-right break-all">{strValue}</span>
                      ) : null}
                    </div>
                    {(strValue.length >= 80 || hasJson) && (
                      <pre className="mt-2 bg-gray-800 rounded p-2 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {hasJson ? formatJsonString(strValue) : strValue}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-800 px-6 py-3 bg-gray-900/95">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Entry ID: {log._id}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(log._raw, null, 2));
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Copy JSON
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
