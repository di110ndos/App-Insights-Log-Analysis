import { useState, useMemo, useCallback } from 'react';
import { LogEntry, TimeWindow, FilterState, ErrorPattern, LogFile, ComparisonResult } from '../types';
import { parseCSV, extractErrorPatterns, getSeverityLabel, compareFiles, calculateFileStats } from '../utils/csvParser';
import LogChart from './LogChart';
import LogGrid from './LogGrid';
import DetailDrawer from './DetailDrawer';
import ErrorPatterns from './ErrorPatterns';
import FileComparison from './FileComparison';
import AIAnalysis from './AIAnalysis';
import APIErrors from './APIErrors';

type ViewMode = 'single' | 'compare';
type TabMode = 'grid' | 'patterns' | 'api-errors' | 'comparison' | 'ai';

const MAX_RECOMMENDED_SIZE = 100 * 1024 * 1024; // 100MB
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function LogDashboard() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [fileSizes, setFileSizes] = useState<number[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [activeTab, setActiveTab] = useState<TabMode>('grid');
  const [selectedPattern, setSelectedPattern] = useState<ErrorPattern | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    timeWindow: null,
    severities: [0, 1, 2, 3],
    searchText: '',
    searchColumn: '_all',
    patternIds: null,
    serverRoles: ['CM', 'CD', 'XP', 'Other']
  });

  // Current file (first file for single mode)
  const currentFile = files[0] || null;
  const compareFile = files[1] || null;
  const logs = currentFile?.logs || [];
  const columns = currentFile?.columns || [];

  const handleFileUpload = useCallback(async (file: File, slot: 0 | 1 = 0) => {
    setLoading(true);
    setError(null);
    setWarning(null);

    // Check file size
    if (file.size > MAX_RECOMMENDED_SIZE) {
      setWarning(`Large file (${formatFileSize(file.size)}). Performance may be affected. Consider filtering the data before export.`);
    }

    // Track file size
    setFileSizes(prev => {
      const updated = [...prev];
      updated[slot] = file.size;
      return updated;
    });

    try {
      const result = await parseCSV(file, slot);
      const stats = calculateFileStats(result.logs);

      const newFile: LogFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        logs: result.logs,
        columns: result.columns,
        mapping: result.detectedMapping,
        stats
      };

      setFiles(prev => {
        const updated = [...prev];
        updated[slot] = newFile;
        return updated.filter(Boolean);
      });

      if (!result.detectedMapping.timestamp) {
        setError('Could not auto-detect timestamp column.');
      }

      // Reset filters when loading new file
      if (slot === 0) {
        setFilters({ timeWindow: null, severities: [0, 1, 2, 3], searchText: '', searchColumn: '_all', patternIds: null, serverRoles: ['CM', 'CD', 'XP', 'Other'] });
        setSelectedPattern(null);
        setSelectedLog(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>, slot: 0 | 1 = 0) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file, slot);
    event.target.value = '';
  }, [handleFileUpload]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileUpload(file, 0);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // Helper to extract server role from customDimensions
  const getInstanceRole = useCallback((log: LogEntry): string | null => {
    const customDimCol = columns.find(c =>
      c.toLowerCase().includes('customdimensions') || c.toLowerCase().includes('custom_dimensions')
    );
    if (!customDimCol || !log._raw[customDimCol]) return null;

    try {
      const dims = JSON.parse(log._raw[customDimCol]);
      const instanceName = dims.InstanceName || dims.instanceName || '';
      if (instanceName.includes('-CM')) return 'CM';
      if (instanceName.includes('-CD')) return 'CD';
      if (instanceName.includes('-XP')) return 'XP';
      return 'Other';
    } catch {
      return null;
    }
  }, [columns]);

  // Check if custom dimensions column exists
  const hasCustomDimensions = useMemo(() => {
    return columns.some(c =>
      c.toLowerCase().includes('customdimensions') || c.toLowerCase().includes('custom_dimensions')
    );
  }, [columns]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!filters.severities.includes(log._severity)) return false;

      if (filters.timeWindow && log._timestamp) {
        const ts = log._timestamp.getTime();
        if (ts < filters.timeWindow.start || ts >= filters.timeWindow.end) return false;
      }

      if (filters.patternIds && !filters.patternIds.includes(log._id)) return false;

      // Server role filter (only apply if custom dimensions exist)
      if (hasCustomDimensions && filters.serverRoles.length < 4) {
        const role = getInstanceRole(log);
        if (role && !filters.serverRoles.includes(role)) return false;
      }

      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (filters.searchColumn === '_all') {
          const allText = Object.values(log._raw).join(' ').toLowerCase();
          if (!allText.includes(search)) return false;
        } else {
          const value = String(log._raw[filters.searchColumn] || '').toLowerCase();
          if (!value.includes(search)) return false;
        }
      }

      return true;
    });
  }, [logs, filters, hasCustomDimensions, getInstanceRole]);

  // Filtered logs for chart (all filters except time window to preserve timeline context)
  const chartFilteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!filters.severities.includes(log._severity)) return false;
      if (filters.patternIds && !filters.patternIds.includes(log._id)) return false;

      // Server role filter
      if (hasCustomDimensions && filters.serverRoles.length < 4) {
        const role = getInstanceRole(log);
        if (role && !filters.serverRoles.includes(role)) return false;
      }

      // Search filter
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (filters.searchColumn === '_all') {
          const allText = Object.values(log._raw).join(' ').toLowerCase();
          if (!allText.includes(search)) return false;
        } else {
          const value = String(log._raw[filters.searchColumn] || '').toLowerCase();
          if (!value.includes(search)) return false;
        }
      }

      return true;
    });
  }, [logs, filters.severities, filters.patternIds, filters.serverRoles, filters.searchText, filters.searchColumn, hasCustomDimensions, getInstanceRole]);

  const errorPatterns = useMemo(() => extractErrorPatterns(logs), [logs]);

  // Comparison result
  const comparisonResult = useMemo<ComparisonResult | null>(() => {
    if (!currentFile || !compareFile) return null;
    return compareFiles(currentFile.logs, compareFile.logs);
  }, [currentFile, compareFile]);

  const stats = useMemo(() => {
    const errors = logs.filter(l => l._severity === 3).length;
    const warnings = logs.filter(l => l._severity === 2).length;
    const withTime = logs.filter(l => l._timestamp);

    let timeRange = '';
    if (withTime.length > 0) {
      const sorted = [...withTime].sort((a, b) => a._timestamp!.getTime() - b._timestamp!.getTime());
      const start = sorted[0]._timestamp!;
      const end = sorted[sorted.length - 1]._timestamp!;
      timeRange = `${start.toLocaleDateString()} ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`;
    }

    return { total: logs.length, errors, warnings, timeRange, filtered: filteredLogs.length };
  }, [logs, filteredLogs]);

  const handleBarClick = useCallback((window: TimeWindow) => {
    setFilters(f => ({ ...f, timeWindow: window, patternIds: null }));
    setSelectedPattern(null);
    setActiveTab('grid');
  }, []);

  const handlePatternClick = useCallback((pattern: ErrorPattern) => {
    setSelectedPattern(pattern);
    setFilters(f => ({ ...f, patternIds: pattern.ids, timeWindow: null }));
    setActiveTab('grid');
  }, []);

  const handleEndpointClick = useCallback((_endpoint: string, logIds: number[]) => {
    setFilters(f => ({ ...f, patternIds: logIds, timeWindow: null }));
    setSelectedPattern(null);
    setActiveTab('grid');
  }, []);

  const handleSeverityToggle = useCallback((severity: number) => {
    setFilters(f => ({
      ...f,
      severities: f.severities.includes(severity)
        ? f.severities.filter(s => s !== severity)
        : [...f.severities, severity]
    }));
  }, []);

  const handleServerRoleToggle = useCallback((role: string) => {
    setFilters(f => ({
      ...f,
      serverRoles: f.serverRoles.includes(role)
        ? f.serverRoles.filter(r => r !== role)
        : [...f.serverRoles, role]
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ timeWindow: null, severities: [0, 1, 2, 3], searchText: '', searchColumn: '_all', patternIds: null, serverRoles: ['CM', 'CD', 'XP', 'Other'] });
    setSelectedPattern(null);
  }, []);

  const clearPatternFilter = useCallback(() => {
    setFilters(f => ({ ...f, patternIds: null }));
    setSelectedPattern(null);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (index === 0) {
      clearFilters();
    }
  }, [clearFilters]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">Log Analyzer</h1>
            <p className="text-xs text-gray-500">Azure App Insights CSV Analysis</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Mode toggle */}
            {files.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1 text-xs rounded ${viewMode === 'single' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                >
                  Single File
                </button>
                <button
                  onClick={() => { setViewMode('compare'); setActiveTab('comparison'); }}
                  className={`px-3 py-1 text-xs rounded ${viewMode === 'compare' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                >
                  Compare Files
                </button>
              </div>
            )}
            {currentFile && (
              <div className="text-sm text-gray-400">
                <span className="font-mono">{currentFile.name}</span>
                <span className="mx-2">•</span>
                <span>{stats.total.toLocaleString()} entries</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-4">
        {/* File Upload */}
        {files.length === 0 && !loading && (
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:border-blue-500/50 transition-colors cursor-pointer bg-gray-900/30"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input-0')?.click()}
          >
            <svg className="mx-auto h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg text-gray-300 mb-2">Drop your CSV file here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
            <input id="file-input-0" type="file" accept=".csv,text/csv" onChange={(e) => handleFileInput(e, 0)} className="hidden" />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            <span className="ml-3 text-gray-400">Parsing CSV...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {warning && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-4 flex items-center justify-between">
            <p className="text-yellow-400">{warning}</p>
            <button onClick={() => setWarning(null)} className="text-yellow-500 hover:text-yellow-400">✕</button>
          </div>
        )}

        {/* Compare mode file slots */}
        {viewMode === 'compare' && files.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[0, 1].map((slot) => {
              const file = files[slot];
              return (
                <div
                  key={slot}
                  className={`bg-gray-900 rounded-lg p-4 border ${file ? 'border-gray-800' : 'border-dashed border-gray-700'}`}
                >
                  {file ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-200">{file.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {file.stats.total.toLocaleString()} entries •
                          <span className="text-red-400 ml-1">{file.stats.errors} errors</span> •
                          <span className="text-yellow-400 ml-1">{file.stats.warnings} warnings</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                          Replace
                          <input type="file" accept=".csv" onChange={(e) => handleFileInput(e, slot as 0 | 1)} className="hidden" />
                        </label>
                        <button onClick={() => removeFile(slot)} className="text-gray-500 hover:text-gray-300">✕</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center py-4 cursor-pointer text-gray-500 hover:text-gray-300">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add {slot === 0 ? 'baseline' : 'comparison'} file
                      <input type="file" accept=".csv" onChange={(e) => handleFileInput(e, slot as 0 | 1)} className="hidden" />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Dashboard */}
        {files.length > 0 && !loading && (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-6 gap-3 mb-4">
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Total</div>
                <div className="text-xl font-bold text-gray-100">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Filtered</div>
                <div className="text-xl font-bold text-blue-400">{stats.filtered.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Errors</div>
                <div className="text-xl font-bold text-red-400">{stats.errors.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Warnings</div>
                <div className="text-xl font-bold text-yellow-400">{stats.warnings.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">File Size</div>
                <div className={`text-xl font-bold ${fileSizes[0] > MAX_RECOMMENDED_SIZE ? 'text-yellow-400' : 'text-gray-100'}`}>
                  {fileSizes[0] ? formatFileSize(fileSizes[0]) : 'N/A'}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Time Range</div>
                <div className="text-sm font-medium text-gray-300 truncate">{stats.timeRange || 'N/A'}</div>
              </div>
            </div>

            {/* Chart */}
            {logs.length > 0 && activeTab !== 'comparison' && (
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-400">Log Frequency Over Time</h2>
                  {selectedPattern && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-purple-400">Showing: {selectedPattern.count} occurrences of selected pattern</span>
                    </div>
                  )}
                </div>
                <LogChart logs={chartFilteredLogs} allLogs={logs} patternIds={filters.patternIds} onBarClick={handleBarClick} selectedTimeWindow={filters.timeWindow} />
              </div>
            )}

            {/* Filters */}
            {activeTab !== 'comparison' && (
              <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-2">Severity:</span>
                  {[3, 2, 1, 0].map(sev => (
                    <button
                      key={sev}
                      onClick={() => handleSeverityToggle(sev)}
                      className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                        filters.severities.includes(sev)
                          ? sev === 3 ? 'bg-red-900/50 text-red-400 border border-red-700'
                          : sev === 2 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                          : sev === 1 ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                          : 'bg-gray-800 text-gray-600 border border-gray-700'
                      }`}
                    >
                      {getSeverityLabel(sev)}
                    </button>
                  ))}
                </div>

                {hasCustomDimensions && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-2">Server Role:</span>
                    {[
                      { role: 'CM', label: 'CM', activeClass: 'bg-blue-900/50 text-blue-400 border border-blue-700' },
                      { role: 'CD', label: 'CD', activeClass: 'bg-green-900/50 text-green-400 border border-green-700' },
                      { role: 'XP', label: 'XP', activeClass: 'bg-purple-900/50 text-purple-400 border border-purple-700' },
                      { role: 'Other', label: 'Other', activeClass: 'bg-gray-700/50 text-gray-400 border border-gray-600' }
                    ].map(({ role, label, activeClass }) => (
                      <button
                        key={role}
                        onClick={() => handleServerRoleToggle(role)}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          filters.serverRoles.includes(role)
                            ? activeClass
                            : 'bg-gray-800 text-gray-600 border border-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                  <select
                    value={filters.searchColumn}
                    onChange={(e) => setFilters(f => ({ ...f, searchColumn: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300"
                  >
                    <option value="_all">All Columns</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={filters.searchText}
                    onChange={(e) => setFilters(f => ({ ...f, searchText: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {filters.timeWindow && (
                  <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-800">
                    <span>Time filtered</span>
                    <button onClick={() => setFilters(f => ({ ...f, timeWindow: null }))} className="hover:text-blue-300">✕</button>
                  </div>
                )}

                {selectedPattern && (
                  <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded border border-purple-800">
                    <span>Pattern: {selectedPattern.count} entries</span>
                    <button onClick={clearPatternFilter} className="hover:text-purple-300">✕</button>
                  </div>
                )}

                <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1">
                  Clear all
                </button>

                <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer px-2 py-1">
                  Load new file
                  <input type="file" accept=".csv" onChange={(e) => handleFileInput(e, 0)} className="hidden" />
                </label>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === 'grid' ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-0' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Log Entries ({filteredLogs.length.toLocaleString()})
              </button>
              <button
                onClick={() => setActiveTab('patterns')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === 'patterns' ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-0' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Patterns ({errorPatterns.length})
              </button>
              <button
                onClick={() => setActiveTab('api-errors')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-1.5 ${
                  activeTab === 'api-errors' ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-0' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                API Errors
              </button>
              {viewMode === 'compare' && (
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    activeTab === 'comparison' ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-0' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  File Comparison
                </button>
              )}
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-1.5 ${
                  activeTab === 'ai' ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-0' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Analysis
              </button>
            </div>

            {/* Content */}
            {activeTab === 'grid' && (
              <LogGrid logs={filteredLogs} columns={columns} onRowClick={setSelectedLog} />
            )}
            {activeTab === 'patterns' && (
              <ErrorPatterns
                patterns={errorPatterns}
                logs={logs}
                onPatternClick={handlePatternClick}
                onViewDetails={setSelectedLog}
                selectedPattern={selectedPattern}
              />
            )}
            {activeTab === 'api-errors' && (
              <APIErrors
                logs={logs}
                onViewDetails={setSelectedLog}
                onEndpointClick={handleEndpointClick}
              />
            )}
            {activeTab === 'comparison' && comparisonResult && (
              <FileComparison
                result={comparisonResult}
                file1Name={currentFile?.name || 'File 1'}
                file2Name={compareFile?.name || 'File 2'}
              />
            )}
            {activeTab === 'comparison' && !comparisonResult && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center text-gray-500">
                Load two files to compare them
              </div>
            )}
            {activeTab === 'ai' && (
              <AIAnalysis
                patterns={errorPatterns}
                logs={logs}
                stats={stats}
              />
            )}

            <DetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
          </>
        )}
      </main>
    </div>
  );
}
