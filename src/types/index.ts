export interface LogEntry {
  _id: number;
  _timestamp: Date | null;
  _severity: number;
  _message: string;
  _raw: Record<string, string>;
  _fileIndex?: number; // For comparison mode
}

export interface ChartDataPoint {
  time: string;
  timestamp: number;
  errors: number;
  warnings: number;
  info: number;
  verbose: number;
  total: number;
  highlighted?: number; // Count of highlighted entries in this bucket
}

export interface TimeWindow {
  start: number;
  end: number;
}

export interface ColumnMapping {
  timestamp: string;
  severity: string;
  message: string;
}

export interface ParsedData {
  logs: LogEntry[];
  columns: string[];
  detectedMapping: ColumnMapping;
}

export interface FilterState {
  timeWindow: TimeWindow | null;
  severities: number[];
  searchText: string;
  searchColumn: string;
  patternIds: number[] | null; // Filter to specific log IDs from pattern
}

export interface ErrorPattern {
  message: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  ids: number[];
  normalized: string;
  severity: number; // Dominant severity (3=error, 2=warning)
  errorCount: number;
  warningCount: number;
}

export interface LogFile {
  id: string;
  name: string;
  logs: LogEntry[];
  columns: string[];
  mapping: ColumnMapping;
  stats: FileStats;
}

export interface FileStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  verbose: number;
  timeStart: Date | null;
  timeEnd: Date | null;
}

export interface ComparisonResult {
  file1Only: ErrorPattern[];
  file2Only: ErrorPattern[];
  bothFiles: { pattern: ErrorPattern; file1Count: number; file2Count: number; change: number }[];
  summary: {
    file1Errors: number;
    file2Errors: number;
    file1Warnings: number;
    file2Warnings: number;
    newPatterns: number;
    resolvedPatterns: number;
    increasedPatterns: number;
    decreasedPatterns: number;
  };
}
