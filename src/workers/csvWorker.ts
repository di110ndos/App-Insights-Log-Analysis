import Papa from 'papaparse';

// Types
interface LogEntry {
  _id: number;
  _timestamp: Date | null;
  _severity: number;
  _message: string;
  _raw: Record<string, string>;
  _fileIndex?: number;
  _serverRole?: string;
}

interface ColumnMapping {
  timestamp: string;
  severity: string;
  message: string;
}

interface ParseMessage {
  type: 'parse';
  file: File;
  fileIndex?: number;
}

// Column detection patterns
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

function detectColumnMapping(columns: string[]): ColumnMapping {
  return {
    timestamp: findColumn(columns, TIMESTAMP_PATTERNS),
    severity: findColumn(columns, SEVERITY_PATTERNS),
    message: findColumn(columns, MESSAGE_PATTERNS)
  };
}

function parseSeverity(value: string | number | undefined): number {
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

function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!isNaN(date.getTime())) return date;
  return null;
}

function extractServerRole(row: Record<string, string>, columns: string[]): string | undefined {
  const customDimCol = columns.find(c =>
    c.toLowerCase() === 'customdimensions' || c.toLowerCase() === 'custom_dimensions'
  );

  if (!customDimCol || !row[customDimCol]) return undefined;

  try {
    const dims = JSON.parse(row[customDimCol]);
    const instanceName = dims.InstanceName || dims.instanceName || '';

    if (instanceName.includes('-CM')) return 'CM';
    if (instanceName.includes('-CD')) return 'CD';
    if (instanceName.includes('-XP')) return 'XP';
    if (instanceName) return 'Other';

    return undefined;
  } catch {
    return undefined;
  }
}

self.onmessage = (e: MessageEvent<ParseMessage>) => {
  const { file, fileIndex } = e.data;

  // Track progress
  let rowsProcessed = 0;
  let totalRows = 0;
  let lastProgressUpdate = 0;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    worker: false, // We're already in a worker
    complete: (parseResult) => {
      if (parseResult.errors.length > 0) {
        console.warn('Parse warnings:', parseResult.errors);
      }

      const columns = parseResult.meta.fields || [];
      const mapping = detectColumnMapping(columns);
      totalRows = (parseResult.data as Record<string, string>[]).length;

      // Process all rows
      const logs: LogEntry[] = (parseResult.data as Record<string, string>[]).map((row, index) => {
        rowsProcessed++;

        // Send progress updates every 10% or every 1000 rows
        const progress = Math.floor((rowsProcessed / totalRows) * 100);
        if (progress - lastProgressUpdate >= 10 || rowsProcessed % 1000 === 0) {
          self.postMessage({
            type: 'progress',
            percent: progress
          });
          lastProgressUpdate = progress;
        }

        const timestamp = mapping.timestamp ? parseTimestamp(row[mapping.timestamp]) : null;
        const severity = mapping.severity ? parseSeverity(row[mapping.severity]) : 1;
        const message = mapping.message ? String(row[mapping.message] || '') :
          Object.values(row).find(v => typeof v === 'string' && String(v).length > 50) as string || '';

        const serverRole = extractServerRole(row, columns);

        return {
          _id: index,
          _timestamp: timestamp,
          _severity: severity,
          _message: message,
          _raw: row,
          _fileIndex: fileIndex,
          _serverRole: serverRole
        };
      });

      // Sort by timestamp (newest first)
      logs.sort((a, b) => {
        if (!a._timestamp && !b._timestamp) return 0;
        if (!a._timestamp) return 1;
        if (!b._timestamp) return -1;
        return b._timestamp.getTime() - a._timestamp.getTime();
      });

      // Send completion with data
      self.postMessage({
        type: 'complete',
        data: {
          logs,
          columns,
          detectedMapping: mapping
        }
      });
    },
    error: (error) => {
      self.postMessage({
        type: 'error',
        message: error.message,
      });
    },
  });
};
