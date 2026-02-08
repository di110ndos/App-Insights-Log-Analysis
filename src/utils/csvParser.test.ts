import { describe, it, expect } from 'vitest';
import {
  detectColumnMapping,
  parseSeverity,
  parseTimestamp,
  normalizeMessage,
  extractErrorPatterns,
  calculateFileStats,
  getSeverityLabel,
  getSeverityColor,
} from './csvParser';
import { LogEntry } from '../types';

// =============================================================================
// Helper: create a LogEntry for tests
// =============================================================================
function makeLog(overrides: Partial<LogEntry> & { _id: number }): LogEntry {
  return {
    _timestamp: null,
    _severity: 1,
    _message: '',
    _raw: {},
    ...overrides,
  };
}

// =============================================================================
// detectColumnMapping
// =============================================================================
describe('detectColumnMapping', () => {
  it('should detect standard Azure App Insights column names', () => {
    const columns = ['timestamp', 'severityLevel', 'message', 'operationId'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('timestamp');
    expect(mapping.severity).toBe('severityLevel');
    expect(mapping.message).toBe('message');
  });

  it('should detect PascalCase Azure column names', () => {
    const columns = ['Timestamp', 'SeverityLevel', 'Message', 'OperationId'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('Timestamp');
    expect(mapping.severity).toBe('SeverityLevel');
    expect(mapping.message).toBe('Message');
  });

  it('should detect alternative column names (time, level, msg)', () => {
    const columns = ['time', 'level', 'msg', 'extra'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('time');
    expect(mapping.severity).toBe('level');
    expect(mapping.message).toBe('msg');
  });

  it('should detect datetime / loglevel / description variations', () => {
    const columns = ['datetime', 'loglevel', 'description'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('datetime');
    expect(mapping.severity).toBe('loglevel');
    expect(mapping.message).toBe('description');
  });

  it('should detect case-insensitive matches', () => {
    const columns = ['TIMESTAMP', 'SEVERITYLEVEL', 'MESSAGE'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('TIMESTAMP');
    expect(mapping.severity).toBe('SEVERITYLEVEL');
    expect(mapping.message).toBe('MESSAGE');
  });

  it('should detect columns via partial / includes match', () => {
    const columns = ['event_timestamp_utc', 'log_severity_level', 'error_message_text'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('event_timestamp_utc');
    expect(mapping.severity).toBe('log_severity_level');
    expect(mapping.message).toBe('error_message_text');
  });

  it('should return empty strings when no columns match', () => {
    const columns = ['foo', 'bar', 'baz'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('');
    expect(mapping.severity).toBe('');
    expect(mapping.message).toBe('');
  });

  it('should handle empty column list', () => {
    const mapping = detectColumnMapping([]);
    expect(mapping.timestamp).toBe('');
    expect(mapping.severity).toBe('');
    expect(mapping.message).toBe('');
  });

  it('should prefer exact match over partial match', () => {
    // 'timestamp' should match exactly before 'my_timestamp_field' via includes
    const columns = ['my_timestamp_field', 'timestamp'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('timestamp');
  });

  it('should detect TimeGenerated (Azure Monitor / Log Analytics)', () => {
    const columns = ['TimeGenerated', 'Type', 'RenderedMessage'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('TimeGenerated');
    expect(mapping.severity).toBe('Type');
    expect(mapping.message).toBe('RenderedMessage');
  });

  it('should detect ingestiontime and innermostmessage', () => {
    const columns = ['ingestiontime', 'severity', 'innermostmessage'];
    const mapping = detectColumnMapping(columns);
    expect(mapping.timestamp).toBe('ingestiontime');
    expect(mapping.severity).toBe('severity');
    expect(mapping.message).toBe('innermostmessage');
  });
});

// =============================================================================
// parseSeverity
// =============================================================================
describe('parseSeverity', () => {
  describe('numeric values', () => {
    it('should return 0 for numeric 0 (verbose)', () => {
      expect(parseSeverity(0)).toBe(0);
    });

    it('should return 1 for numeric 1 (info)', () => {
      expect(parseSeverity(1)).toBe(1);
    });

    it('should return 2 for numeric 2 (warning)', () => {
      expect(parseSeverity(2)).toBe(2);
    });

    it('should return 3 for numeric 3 (error)', () => {
      expect(parseSeverity(3)).toBe(3);
    });

    it('should return 4 for numeric 4 (critical)', () => {
      expect(parseSeverity(4)).toBe(4);
    });

    it('should parse string "0" as 0', () => {
      expect(parseSeverity('0')).toBe(0);
    });

    it('should parse string "3" as 3', () => {
      expect(parseSeverity('3')).toBe(3);
    });

    it('should parse string "4" as 4', () => {
      expect(parseSeverity('4')).toBe(4);
    });
  });

  describe('string severity labels', () => {
    it('should map "error" to 3', () => {
      expect(parseSeverity('error')).toBe(3);
    });

    it('should map "Error" to 3 (case-insensitive)', () => {
      expect(parseSeverity('Error')).toBe(3);
    });

    it('should map "ERROR" to 3 (case-insensitive)', () => {
      expect(parseSeverity('ERROR')).toBe(3);
    });

    it('should map "critical" to 3', () => {
      expect(parseSeverity('critical')).toBe(3);
    });

    it('should map "fatal" to 3', () => {
      expect(parseSeverity('fatal')).toBe(3);
    });

    it('should map "warning" to 2', () => {
      expect(parseSeverity('warning')).toBe(2);
    });

    it('should map "Warning" to 2', () => {
      expect(parseSeverity('Warning')).toBe(2);
    });

    it('should map "warn" to 2', () => {
      expect(parseSeverity('warn')).toBe(2);
    });

    it('should map "info" to 1', () => {
      expect(parseSeverity('info')).toBe(1);
    });

    it('should map "information" to 1', () => {
      expect(parseSeverity('information')).toBe(1);
    });

    it('should map "Information" to 1', () => {
      expect(parseSeverity('Information')).toBe(1);
    });

    it('should map "verbose" to 0', () => {
      expect(parseSeverity('verbose')).toBe(0);
    });

    it('should map "debug" to 0', () => {
      expect(parseSeverity('debug')).toBe(0);
    });

    it('should map "trace" to 0', () => {
      expect(parseSeverity('trace')).toBe(0);
    });

    it('should map "Verbose" to 0 (case-insensitive)', () => {
      expect(parseSeverity('Verbose')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for undefined', () => {
      expect(parseSeverity(undefined)).toBe(0);
    });

    it('should return 0 for null (cast)', () => {
      expect(parseSeverity(null as unknown as undefined)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseSeverity('')).toBe(0);
    });

    it('should default to 1 for unrecognized strings', () => {
      expect(parseSeverity('something_unknown')).toBe(1);
    });

    it('should handle whitespace-padded values', () => {
      expect(parseSeverity('  error  ')).toBe(3);
    });

    it('should handle strings containing severity keywords', () => {
      expect(parseSeverity('HttpError')).toBe(3);
      expect(parseSeverity('UserWarning')).toBe(2);
    });

    it('should reject numbers outside 0-4 range and fall back to string matching', () => {
      // '5' is not in 0-4 range, parseInt gives 5 which fails the range check,
      // then it falls through to string matching (no match) => default 1
      expect(parseSeverity('5')).toBe(1);
      expect(parseSeverity('99')).toBe(1);
      expect(parseSeverity('-1')).toBe(1);
    });
  });
});

// =============================================================================
// parseTimestamp
// =============================================================================
describe('parseTimestamp', () => {
  it('should parse a valid ISO 8601 date string', () => {
    const result = parseTimestamp('2024-01-15T10:30:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should parse a date-only string', () => {
    const result = parseTimestamp('2024-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(5); // June is 0-indexed
    expect(result!.getDate()).toBe(15);
  });

  it('should parse an ISO date with milliseconds', () => {
    const result = parseTimestamp('2024-03-20T14:25:30.123Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMilliseconds()).toBe(123);
  });

  it('should parse a date with timezone offset', () => {
    const result = parseTimestamp('2024-01-15T10:30:00+05:30');
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  it('should return null for undefined', () => {
    expect(parseTimestamp(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseTimestamp('')).toBeNull();
  });

  it('should return null for invalid date string', () => {
    expect(parseTimestamp('not-a-date')).toBeNull();
  });

  it('should return null for random text', () => {
    expect(parseTimestamp('hello world')).toBeNull();
  });

  it('should parse a standard date-time string', () => {
    const result = parseTimestamp('January 15, 2024 10:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
  });

  it('should parse Azure App Insights timestamp format', () => {
    const result = parseTimestamp('2024-01-15T10:30:00.0000000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
  });
});

// =============================================================================
// normalizeMessage
// =============================================================================
describe('normalizeMessage', () => {
  it('should replace GUIDs with <GUID>', () => {
    const msg = 'Request 550e8400-e29b-41d4-a716-446655440000 failed';
    expect(normalizeMessage(msg)).toBe('Request <GUID> failed');
  });

  it('should replace multiple GUIDs', () => {
    const msg = 'Op 550e8400-e29b-41d4-a716-446655440000 dep 123e4567-e89b-12d3-a456-426614174000';
    const result = normalizeMessage(msg);
    expect(result).not.toContain('550e8400');
    expect(result).not.toContain('123e4567');
    expect(result).toContain('<GUID>');
  });

  it('should replace ISO timestamps with <TIMESTAMP>', () => {
    const msg = 'Error at 2024-01-15T10:30:00Z in service';
    expect(normalizeMessage(msg)).toBe('Error at <TIMESTAMP> in service');
  });

  it('should replace timestamps with time zone offsets', () => {
    const msg = 'Failed at 2024-03-20T14:25:30+05:30 during sync';
    const result = normalizeMessage(msg);
    expect(result).toContain('<TIMESTAMP>');
    expect(result).not.toContain('2024-03-20');
  });

  it('should replace timestamps with space separator', () => {
    const msg = 'Logged at 2024-01-15 10:30:00 by system';
    const result = normalizeMessage(msg);
    expect(result).toContain('<TIMESTAMP>');
  });

  it('should replace standalone numbers with <NUM>', () => {
    const msg = 'Processed 42 items in 1500 ms';
    const result = normalizeMessage(msg);
    expect(result).toBe('Processed <NUM> items in <NUM> ms');
  });

  it('should replace hex values with <HEX>', () => {
    const msg = 'Memory at 0x7fff5fbff8a0 corrupted';
    expect(normalizeMessage(msg)).toBe('Memory at <HEX> corrupted');
  });

  it('should replace uppercase hex values', () => {
    const msg = 'Address 0xDEADBEEF invalid';
    expect(normalizeMessage(msg)).toBe('Address <HEX> invalid');
  });

  it('should handle combined replacements (GUID + timestamp + number)', () => {
    const msg = 'Request 550e8400-e29b-41d4-a716-446655440000 at 2024-01-15T10:30:00Z took 250 ms';
    const result = normalizeMessage(msg);
    expect(result).toContain('<GUID>');
    expect(result).toContain('<TIMESTAMP>');
    expect(result).toContain('<NUM>');
    expect(result).not.toContain('550e8400');
    expect(result).not.toContain('2024-01-15');
    expect(result).not.toContain('250');
  });

  it('should truncate messages longer than 200 characters', () => {
    const msg = 'A'.repeat(300);
    const result = normalizeMessage(msg);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('should not truncate messages at or under 200 characters', () => {
    const msg = 'Short message';
    const result = normalizeMessage(msg);
    expect(result).toBe('Short message');
  });

  it('should trim whitespace from result', () => {
    const msg = '  some message with spaces  ';
    const result = normalizeMessage(msg);
    expect(result).toBe('some message with spaces');
  });

  it('should handle empty string', () => {
    expect(normalizeMessage('')).toBe('');
  });

  it('should handle message with only a GUID', () => {
    const msg = '550e8400-e29b-41d4-a716-446655440000';
    expect(normalizeMessage(msg)).toBe('<GUID>');
  });
});

// =============================================================================
// extractErrorPatterns
// =============================================================================
describe('extractErrorPatterns', () => {
  it('should filter out logs with severity < 2 (info and verbose)', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 0, _message: 'verbose msg' }),
      makeLog({ _id: 2, _severity: 1, _message: 'info msg' }),
      makeLog({ _id: 3, _severity: 2, _message: 'warning msg' }),
      makeLog({ _id: 4, _severity: 3, _message: 'error msg' }),
    ];
    const patterns = extractErrorPatterns(logs);
    const messages = patterns.map(p => p.message);
    expect(messages).not.toContain('verbose msg');
    expect(messages).not.toContain('info msg');
    expect(messages.some(m => m.includes('warning'))).toBe(true);
    expect(messages.some(m => m.includes('error'))).toBe(true);
  });

  it('should group similar messages together by normalized form', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: 'Request 123 failed' }),
      makeLog({ _id: 2, _severity: 3, _message: 'Request 456 failed' }),
      makeLog({ _id: 3, _severity: 3, _message: 'Request 789 failed' }),
    ];
    const patterns = extractErrorPatterns(logs);
    // All three should be grouped because after normalization numbers become <NUM>
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(3);
    expect(patterns[0].ids).toEqual([1, 2, 3]);
  });

  it('should track error and warning counts separately', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: 'Connection timeout 100' }),
      makeLog({ _id: 2, _severity: 2, _message: 'Connection timeout 200' }),
      makeLog({ _id: 3, _severity: 2, _message: 'Connection timeout 300' }),
    ];
    const patterns = extractErrorPatterns(logs);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].errorCount).toBe(1);
    expect(patterns[0].warningCount).toBe(2);
    expect(patterns[0].count).toBe(3);
  });

  it('should set dominant severity to 3 if any errors exist in the pattern', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 2, _message: 'DB slow query took 10 ms' }),
      makeLog({ _id: 2, _severity: 3, _message: 'DB slow query took 20 ms' }),
    ];
    const patterns = extractErrorPatterns(logs);
    // Both messages normalize to "DB slow query took <NUM> ms" => single pattern
    expect(patterns).toHaveLength(1);
    expect(patterns[0].severity).toBe(3);
  });

  it('should set dominant severity to 2 if only warnings exist in the pattern', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 2, _message: 'Cache miss for key abc' }),
      makeLog({ _id: 2, _severity: 2, _message: 'Cache miss for key def' }),
    ];
    const patterns = extractErrorPatterns(logs);
    expect(patterns[0].severity).toBe(2);
  });

  it('should sort patterns by count descending', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: 'Rare error' }),
      makeLog({ _id: 2, _severity: 3, _message: 'Common error 1' }),
      makeLog({ _id: 3, _severity: 3, _message: 'Common error 2' }),
      makeLog({ _id: 4, _severity: 3, _message: 'Common error 3' }),
    ];
    const patterns = extractErrorPatterns(logs);
    expect(patterns.length).toBe(2);
    expect(patterns[0].count).toBe(3); // "Common error <NUM>"
    expect(patterns[1].count).toBe(1); // "Rare error"
  });

  it('should limit results to 100 patterns', () => {
    const logs: LogEntry[] = [];
    for (let i = 0; i < 150; i++) {
      logs.push(
        makeLog({
          _id: i,
          _severity: 3,
          _message: `Unique error pattern number_${i}_unique_${i * 1000}_text`,
        })
      );
    }
    // Each message has a unique structure after normalization because of the
    // "unique" text mixed with numbers in a distinct format => many distinct patterns
    // We need truly unique normalized forms. Let's use distinct alphabetic words:
    const uniqueLogs: LogEntry[] = [];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < 150; i++) {
      // Use combinations of letters to create distinct messages
      const word = `uniquepattern${alphabet[i % 26]}${alphabet[Math.floor(i / 26) % 26]}`;
      uniqueLogs.push(
        makeLog({
          _id: i,
          _severity: 3,
          _message: word,
        })
      );
    }
    const patterns = extractErrorPatterns(uniqueLogs);
    expect(patterns.length).toBeLessThanOrEqual(100);
  });

  it('should track firstSeen and lastSeen timestamps', () => {
    const early = new Date('2024-01-01T00:00:00Z');
    const middle = new Date('2024-06-15T12:00:00Z');
    const late = new Date('2024-12-31T23:59:59Z');

    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: 'timeout error 1', _timestamp: middle }),
      makeLog({ _id: 2, _severity: 3, _message: 'timeout error 2', _timestamp: early }),
      makeLog({ _id: 3, _severity: 3, _message: 'timeout error 3', _timestamp: late }),
    ];

    const patterns = extractErrorPatterns(logs);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].firstSeen).toEqual(early);
    expect(patterns[0].lastSeen).toEqual(late);
  });

  it('should return empty array for empty input', () => {
    expect(extractErrorPatterns([])).toEqual([]);
  });

  it('should return empty array when all logs are below severity 2', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 0, _message: 'verbose' }),
      makeLog({ _id: 2, _severity: 1, _message: 'info' }),
    ];
    expect(extractErrorPatterns(logs)).toEqual([]);
  });

  it('should store the original message (first occurrence) in the pattern', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: 'Failed to connect to server 192' }),
      makeLog({ _id: 2, _severity: 3, _message: 'Failed to connect to server 193' }),
    ];
    const patterns = extractErrorPatterns(logs);
    // The first message seen is stored as the representative message
    expect(patterns[0].message).toBe('Failed to connect to server 192');
  });

  it('should truncate stored message to 200 characters', () => {
    const longMessage = 'E'.repeat(300);
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3, _message: longMessage }),
    ];
    const patterns = extractErrorPatterns(logs);
    expect(patterns[0].message.length).toBeLessThanOrEqual(200);
  });
});

// =============================================================================
// calculateFileStats
// =============================================================================
describe('calculateFileStats', () => {
  it('should count totals correctly', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 0 }),
      makeLog({ _id: 2, _severity: 1 }),
      makeLog({ _id: 3, _severity: 2 }),
      makeLog({ _id: 4, _severity: 3 }),
      makeLog({ _id: 5, _severity: 1 }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.total).toBe(5);
    expect(stats.verbose).toBe(1);
    expect(stats.info).toBe(2);
    expect(stats.warnings).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it('should detect time range from timestamps', () => {
    const early = new Date('2024-01-01T00:00:00Z');
    const late = new Date('2024-12-31T23:59:59Z');
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 1, _timestamp: late }),
      makeLog({ _id: 2, _severity: 1, _timestamp: early }),
      makeLog({ _id: 3, _severity: 1, _timestamp: new Date('2024-06-15T12:00:00Z') }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.timeStart).toEqual(early);
    expect(stats.timeEnd).toEqual(late);
  });

  it('should return null time range for empty logs', () => {
    const stats = calculateFileStats([]);
    expect(stats.total).toBe(0);
    expect(stats.errors).toBe(0);
    expect(stats.warnings).toBe(0);
    expect(stats.info).toBe(0);
    expect(stats.verbose).toBe(0);
    expect(stats.timeStart).toBeNull();
    expect(stats.timeEnd).toBeNull();
  });

  it('should return null time range when no logs have timestamps', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 1, _timestamp: null }),
      makeLog({ _id: 2, _severity: 3, _timestamp: null }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.total).toBe(2);
    expect(stats.timeStart).toBeNull();
    expect(stats.timeEnd).toBeNull();
  });

  it('should handle logs with mixed null and valid timestamps', () => {
    const validDate = new Date('2024-07-04T12:00:00Z');
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 1, _timestamp: null }),
      makeLog({ _id: 2, _severity: 1, _timestamp: validDate }),
      makeLog({ _id: 3, _severity: 1, _timestamp: null }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.timeStart).toEqual(validDate);
    expect(stats.timeEnd).toEqual(validDate);
  });

  it('should handle all same severity', () => {
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 3 }),
      makeLog({ _id: 2, _severity: 3 }),
      makeLog({ _id: 3, _severity: 3 }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.total).toBe(3);
    expect(stats.errors).toBe(3);
    expect(stats.warnings).toBe(0);
    expect(stats.info).toBe(0);
    expect(stats.verbose).toBe(0);
  });

  it('should handle single log entry', () => {
    const ts = new Date('2024-05-01T08:00:00Z');
    const logs: LogEntry[] = [
      makeLog({ _id: 1, _severity: 2, _timestamp: ts }),
    ];
    const stats = calculateFileStats(logs);
    expect(stats.total).toBe(1);
    expect(stats.warnings).toBe(1);
    expect(stats.timeStart).toEqual(ts);
    expect(stats.timeEnd).toEqual(ts);
  });
});

// =============================================================================
// getSeverityLabel
// =============================================================================
describe('getSeverityLabel', () => {
  it('should return "Verbose" for severity 0', () => {
    expect(getSeverityLabel(0)).toBe('Verbose');
  });

  it('should return "Info" for severity 1', () => {
    expect(getSeverityLabel(1)).toBe('Info');
  });

  it('should return "Warning" for severity 2', () => {
    expect(getSeverityLabel(2)).toBe('Warning');
  });

  it('should return "Error" for severity 3', () => {
    expect(getSeverityLabel(3)).toBe('Error');
  });

  it('should return "Unknown" for out-of-range positive value', () => {
    expect(getSeverityLabel(4)).toBe('Unknown');
    expect(getSeverityLabel(99)).toBe('Unknown');
  });

  it('should return "Unknown" for negative value', () => {
    expect(getSeverityLabel(-1)).toBe('Unknown');
  });
});

// =============================================================================
// getSeverityColor
// =============================================================================
describe('getSeverityColor', () => {
  it('should return gray (#6b7280) for severity 0 (Verbose)', () => {
    expect(getSeverityColor(0)).toBe('#6b7280');
  });

  it('should return blue (#3b82f6) for severity 1 (Info)', () => {
    expect(getSeverityColor(1)).toBe('#3b82f6');
  });

  it('should return yellow (#eab308) for severity 2 (Warning)', () => {
    expect(getSeverityColor(2)).toBe('#eab308');
  });

  it('should return red (#ef4444) for severity 3 (Error)', () => {
    expect(getSeverityColor(3)).toBe('#ef4444');
  });

  it('should return default gray (#6b7280) for out-of-range value', () => {
    expect(getSeverityColor(4)).toBe('#6b7280');
    expect(getSeverityColor(-1)).toBe('#6b7280');
    expect(getSeverityColor(100)).toBe('#6b7280');
  });
});
