import { FilterState, ErrorPattern } from '../types';
import { getSeverityLabel } from '../utils/csvParser';

interface FilterBarProps {
  filters: FilterState;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  severities: number[];
  onSeverityToggle: (severity: number) => void;
  hasCustomDimensions: boolean;
  serverRoles: string[];
  onServerRoleToggle: (role: string) => void;
  columns: string[];
  onSearchColumnChange: (column: string) => void;
  onTimeWindowClear: () => void;
  selectedPattern: ErrorPattern | null;
  onClearPatternFilter: () => void;
  onClearFilters: () => void;
  onFileInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  filteredCount: number;
}

export default function FilterBar({
  filters,
  searchInput,
  onSearchInputChange,
  severities,
  onSeverityToggle,
  hasCustomDimensions,
  serverRoles,
  onServerRoleToggle,
  columns,
  onSearchColumnChange,
  onTimeWindowClear,
  selectedPattern,
  onClearPatternFilter,
  onClearFilters,
  onFileInput,
  onExport,
  filteredCount
}: FilterBarProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-2">Severity:</span>
        {[4, 3, 2, 1, 0].map(sev => (
          <button
            key={sev}
            onClick={() => onSeverityToggle(sev)}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              severities.includes(sev)
                ? sev === 4 ? 'bg-orange-900/50 text-orange-400 border border-orange-700'
                : sev === 3 ? 'bg-red-900/50 text-red-400 border border-red-700'
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
              onClick={() => onServerRoleToggle(role)}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                serverRoles.includes(role)
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
          onChange={(e) => onSearchColumnChange(e.target.value)}
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
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {filters.timeWindow && (
        <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-800">
          <span>Time filtered</span>
          <button onClick={onTimeWindowClear} className="hover:text-blue-300">✕</button>
        </div>
      )}

      {selectedPattern && (
        <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded border border-purple-800">
          <span>Pattern: {selectedPattern.count} entries</span>
          <button onClick={onClearPatternFilter} className="hover:text-purple-300">✕</button>
        </div>
      )}

      <button onClick={onClearFilters} className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1">
        Clear all
      </button>

      <button onClick={onExport} className="text-xs text-green-400 hover:text-green-300 px-2 py-1" title={`Export ${filteredCount} filtered logs`}>
        Export CSV ({filteredCount.toLocaleString()})
      </button>

      <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer px-2 py-1">
        Load new file
        <input type="file" accept=".csv" onChange={onFileInput} className="hidden" />
      </label>
    </div>
  );
}
