import Papa from 'papaparse';
import { LogEntry, ColumnMapping, ParsedData, ErrorPattern, FileStats, ComparisonResult } from '../types';

// Common column name variations for Azure App Insights
const TIMESTAMP_PATTERNS = [
  'timestamp', 'time', 'datetime', 'date', 'created', 'logged',
  'eventtime', 'timegenerated', 'ingestiontime', 'clienttime',
  'Timestamp', 'Time', 'DateTime', 'Date', 'TimeGenerated'
];

const SEVERITY_PATTERNS = [
  'severitylevel', 'severity', 'level', 'loglevel', 'type',
  'SeverityLevel', 'Severity', 'Level', 'LogLevel', 'Type'
];

const MESSAGE_PATTERNS = [
  'message', 'msg', 'description', 'text', 'details', 'content',
  'renderedmessage', 'innermostmessage', 'outermessage', 'problemid',
  'Message', 'Msg', 'Description', 'Text', 'Details', 'RenderedMessage'
];

function findColumn(columns: string[], patterns: string[]): string {
  for (const pattern of patterns) {
    const found = columns.find(c => c.toLowerCase() === pattern.toLowerCase());
    if (found) return found;
  }
  for (const pattern of patterns) {
    const found = columns.find(c => c.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return '';
}

export function detectColumnMapping(columns: string[]): ColumnMapping {
  return {
    timestamp: findColumn(columns, TIMESTAMP_PATTERNS),
    severity: findColumn(columns, SEVERITY_PATTERNS),
    message: findColumn(columns, MESSAGE_PATTERNS)
  };
}

export function parseSeverity(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;

  const str = String(value).toLowerCase().trim();
  const num = parseInt(str);
  if (!isNaN(num) && num >= 0 && num <= 4) return num;

  if (str.includes('error') || str.includes('critical') || str.includes('fatal')) return 3;
  if (str.includes('warn')) return 2;
  if (str.includes('info') || str.includes('information')) return 1;
  if (str.includes('verbose') || str.includes('debug') || str.includes('trace')) return 0;

  return 1;
}

export function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!isNaN(date.getTime())) return date;
  return null;
}

export function parseCSV(file: File, fileIndex?: number): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        if (parseResult.errors.length > 0) {
          console.warn('Parse warnings:', parseResult.errors);
        }

        const columns = parseResult.meta.fields || [];
        const mapping = detectColumnMapping(columns);

        const logs: LogEntry[] = (parseResult.data as Record<string, string>[]).map((row, index) => {
          const timestamp = mapping.timestamp ? parseTimestamp(row[mapping.timestamp]) : null;
          const severity = mapping.severity ? parseSeverity(row[mapping.severity]) : 1;
          const message = mapping.message ? String(row[mapping.message] || '') :
            Object.values(row).find(v => typeof v === 'string' && String(v).length > 50) as string || '';

          return {
            _id: index,
            _timestamp: timestamp,
            _severity: severity,
            _message: message,
            _raw: row,
            _fileIndex: fileIndex
          };
        });

        logs.sort((a, b) => {
          if (!a._timestamp && !b._timestamp) return 0;
          if (!a._timestamp) return 1;
          if (!b._timestamp) return -1;
          return b._timestamp.getTime() - a._timestamp.getTime();
        });

        resolve({ logs, columns, detectedMapping: mapping });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function normalizeMessage(message: string): string {
  return message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<GUID>')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/\b\d+\b/g, '<NUM>')
    .replace(/0x[0-9a-f]+/gi, '<HEX>')
    .substring(0, 200)
    .trim();
}

export function extractErrorPatterns(logs: LogEntry[]): ErrorPattern[] {
  const patterns = new Map<string, ErrorPattern>();

  logs.forEach(log => {
    if (log._severity < 2) return;

    const normalized = normalizeMessage(log._message);

    if (!patterns.has(normalized)) {
      patterns.set(normalized, {
        message: log._message.substring(0, 200),
        normalized,
        count: 0,
        firstSeen: log._timestamp || new Date(),
        lastSeen: log._timestamp || new Date(),
        ids: [],
        severity: log._severity,
        errorCount: 0,
        warningCount: 0
      });
    }

    const pattern = patterns.get(normalized)!;
    pattern.count++;
    pattern.ids.push(log._id);

    // Track error vs warning counts
    if (log._severity === 3) {
      pattern.errorCount++;
    } else if (log._severity === 2) {
      pattern.warningCount++;
    }

    // Set dominant severity (errors take precedence)
    pattern.severity = pattern.errorCount > 0 ? 3 : 2;

    if (log._timestamp) {
      if (log._timestamp < pattern.firstSeen) pattern.firstSeen = log._timestamp;
      if (log._timestamp > pattern.lastSeen) pattern.lastSeen = log._timestamp;
    }
  });

  return Array.from(patterns.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);
}

export function calculateFileStats(logs: LogEntry[]): FileStats {
  const withTime = logs.filter(l => l._timestamp).sort((a, b) => a._timestamp!.getTime() - b._timestamp!.getTime());

  return {
    total: logs.length,
    errors: logs.filter(l => l._severity === 3).length,
    warnings: logs.filter(l => l._severity === 2).length,
    info: logs.filter(l => l._severity === 1).length,
    verbose: logs.filter(l => l._severity === 0).length,
    timeStart: withTime.length > 0 ? withTime[0]._timestamp : null,
    timeEnd: withTime.length > 0 ? withTime[withTime.length - 1]._timestamp : null
  };
}

export function compareFiles(logs1: LogEntry[], logs2: LogEntry[]): ComparisonResult {
  const patterns1 = new Map<string, { count: number; ids: number[] }>();
  const patterns2 = new Map<string, { count: number; ids: number[] }>();
  const allPatternMessages = new Map<string, string>();

  // Build patterns for file 1
  logs1.forEach(log => {
    if (log._severity < 2) return;
    const normalized = normalizeMessage(log._message);
    if (!patterns1.has(normalized)) {
      patterns1.set(normalized, { count: 0, ids: [] });
      if (!allPatternMessages.has(normalized)) {
        allPatternMessages.set(normalized, log._message.substring(0, 200));
      }
    }
    patterns1.get(normalized)!.count++;
    patterns1.get(normalized)!.ids.push(log._id);
  });

  // Build patterns for file 2
  logs2.forEach(log => {
    if (log._severity < 2) return;
    const normalized = normalizeMessage(log._message);
    if (!patterns2.has(normalized)) {
      patterns2.set(normalized, { count: 0, ids: [] });
      if (!allPatternMessages.has(normalized)) {
        allPatternMessages.set(normalized, log._message.substring(0, 200));
      }
    }
    patterns2.get(normalized)!.count++;
    patterns2.get(normalized)!.ids.push(log._id);
  });

  const file1Only: ErrorPattern[] = [];
  const file2Only: ErrorPattern[] = [];
  const bothFiles: { pattern: ErrorPattern; file1Count: number; file2Count: number; change: number }[] = [];

  // Find patterns only in file 1
  patterns1.forEach((data, normalized) => {
    if (!patterns2.has(normalized)) {
      file1Only.push({
        message: allPatternMessages.get(normalized) || normalized,
        normalized,
        count: data.count,
        firstSeen: new Date(),
        lastSeen: new Date(),
        ids: data.ids,
        severity: 3,
        errorCount: data.count,
        warningCount: 0
      });
    }
  });

  // Find patterns only in file 2 or in both
  patterns2.forEach((data2, normalized) => {
    const data1 = patterns1.get(normalized);
    if (!data1) {
      file2Only.push({
        message: allPatternMessages.get(normalized) || normalized,
        normalized,
        count: data2.count,
        firstSeen: new Date(),
        lastSeen: new Date(),
        ids: data2.ids,
        severity: 3,
        errorCount: data2.count,
        warningCount: 0
      });
    } else {
      const change = ((data2.count - data1.count) / data1.count) * 100;
      bothFiles.push({
        pattern: {
          message: allPatternMessages.get(normalized) || normalized,
          normalized,
          count: data2.count,
          firstSeen: new Date(),
          lastSeen: new Date(),
          ids: data2.ids,
          severity: 3,
          errorCount: data2.count,
          warningCount: 0
        },
        file1Count: data1.count,
        file2Count: data2.count,
        change
      });
    }
  });

  // Sort
  file1Only.sort((a, b) => b.count - a.count);
  file2Only.sort((a, b) => b.count - a.count);
  bothFiles.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const stats1 = calculateFileStats(logs1);
  const stats2 = calculateFileStats(logs2);

  return {
    file1Only,
    file2Only,
    bothFiles,
    summary: {
      file1Errors: stats1.errors,
      file2Errors: stats2.errors,
      file1Warnings: stats1.warnings,
      file2Warnings: stats2.warnings,
      newPatterns: file2Only.length,
      resolvedPatterns: file1Only.length,
      increasedPatterns: bothFiles.filter(b => b.change > 10).length,
      decreasedPatterns: bothFiles.filter(b => b.change < -10).length
    }
  };
}

export function getSeverityLabel(severity: number): string {
  const labels = ['Verbose', 'Info', 'Warning', 'Error'];
  return labels[severity] || 'Unknown';
}

export function getSeverityColor(severity: number): string {
  const colors = ['#6b7280', '#3b82f6', '#eab308', '#ef4444'];
  return colors[severity] || '#6b7280';
}
