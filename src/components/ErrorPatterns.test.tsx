import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorPatterns from './ErrorPatterns';
import { ErrorPattern, LogEntry } from '../types';

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
// Helper: create an ErrorPattern for tests
// =============================================================================
function makePattern(overrides: Partial<ErrorPattern> = {}): ErrorPattern {
  return {
    message: 'Test error message',
    normalized: 'Test error message',
    count: 5,
    firstSeen: new Date('2024-01-15T10:00:00Z'),
    lastSeen: new Date('2024-01-15T12:00:00Z'),
    ids: [1, 2, 3, 4, 5],
    severity: 3,
    errorCount: 5,
    warningCount: 0,
    ...overrides,
  };
}

// =============================================================================
// ErrorPatterns Component Tests
// =============================================================================
describe('ErrorPatterns', () => {
  it('should show "No patterns found" when patterns array is empty', () => {
    const onPatternClick = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <ErrorPatterns
        patterns={[]}
        logs={[]}
        onPatternClick={onPatternClick}
        onViewDetails={onViewDetails}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('No patterns found')).toBeInTheDocument();
  });

  it('should render pattern count and message text', () => {
    const pattern = makePattern({
      message: 'Connection timeout error',
      count: 42,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Connection timeout error')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display severity badges for Error', () => {
    const pattern = makePattern({
      severity: 3,
      errorCount: 10,
      warningCount: 0,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should display severity badges for Warning', () => {
    const pattern = makePattern({
      severity: 2,
      errorCount: 0,
      warningCount: 8,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should show error count and warning count when both exist', () => {
    const pattern = makePattern({
      severity: 3,
      errorCount: 7,
      warningCount: 3,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('(7 errors, 3 warnings)')).toBeInTheDocument();
  });

  it('should call onPatternClick when a pattern row is clicked', () => {
    const pattern = makePattern({ message: 'Click me' });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));
    const onPatternClick = vi.fn();

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={onPatternClick}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    const patternRow = screen.getByText('Click me').closest('div[class*="cursor-pointer"]');
    fireEvent.click(patternRow!);

    expect(onPatternClick).toHaveBeenCalledWith(pattern);
    expect(onPatternClick).toHaveBeenCalledTimes(1);
  });

  it('should call onViewDetails when "View Details" button is clicked', () => {
    const pattern = makePattern({
      message: 'Test pattern',
      ids: [10, 20, 30],
    });
    const logs = [
      makeLog({ _id: 10, _message: 'Log 10' }),
      makeLog({ _id: 20, _message: 'Log 20' }),
      makeLog({ _id: 30, _message: 'Log 30' }),
    ];
    const onViewDetails = vi.fn();

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={onViewDetails}
        selectedPattern={null}
      />
    );

    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);

    expect(onViewDetails).toHaveBeenCalledWith(logs[0]);
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('should not call onPatternClick when "View Details" button is clicked (stopPropagation)', () => {
    const pattern = makePattern({ ids: [1] });
    const logs = [makeLog({ _id: 1 })];
    const onPatternClick = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={onPatternClick}
        onViewDetails={onViewDetails}
        selectedPattern={null}
      />
    );

    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onPatternClick).not.toHaveBeenCalled();
  });

  it('should highlight selected pattern with purple styling', () => {
    const pattern = makePattern({
      message: 'Selected pattern',
      normalized: 'selected pattern',
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={pattern}
      />
    );

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('1 pattern selected - click to view in chart & grid')).toBeInTheDocument();
  });

  it('should show firstSeen and lastSeen dates', () => {
    const pattern = makePattern({
      firstSeen: new Date('2024-01-15T10:00:00Z'),
      lastSeen: new Date('2024-01-15T14:30:00Z'),
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    // Check for date text matching the format "Jan 15, 10:00 AM"
    // Using regex to match the date format
    expect(screen.getByText(/First:/)).toBeInTheDocument();
    expect(screen.getByText(/Last:/)).toBeInTheDocument();
  });

  it('should display patterns sorted by count (highest first)', () => {
    const pattern1 = makePattern({
      message: 'Low count pattern',
      count: 5,
      ids: [1, 2, 3, 4, 5],
    });
    const pattern2 = makePattern({
      message: 'High count pattern',
      count: 50,
      ids: Array.from({ length: 50 }, (_, i) => i + 10),
    });
    const pattern3 = makePattern({
      message: 'Medium count pattern',
      count: 20,
      ids: Array.from({ length: 20 }, (_, i) => i + 100),
    });

    const allLogs = [
      ...pattern1.ids.map(id => makeLog({ _id: id })),
      ...pattern2.ids.map(id => makeLog({ _id: id })),
      ...pattern3.ids.map(id => makeLog({ _id: id })),
    ];

    render(
      <ErrorPatterns
        patterns={[pattern2, pattern3, pattern1]} // Pre-sorted as component expects
        logs={allLogs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    // Verify counts are displayed
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show "Click to filter & view in chart" for unselected patterns', () => {
    const pattern = makePattern({ message: 'Unselected' });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Click to filter & view in chart')).toBeInTheDocument();
  });

  it('should show "Click again to deselect" for selected patterns', () => {
    const pattern = makePattern({
      message: 'Selected',
      normalized: 'selected',
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={pattern}
      />
    );

    expect(screen.getByText('Click again to deselect')).toBeInTheDocument();
  });

  it('should display total unique patterns count in header', () => {
    const patterns = [
      makePattern({ message: 'Pattern 1', ids: [1] }),
      makePattern({ message: 'Pattern 2', ids: [2] }),
      makePattern({ message: 'Pattern 3', ids: [3] }),
    ];
    const logs = [
      makeLog({ _id: 1 }),
      makeLog({ _id: 2 }),
      makeLog({ _id: 3 }),
    ];

    render(
      <ErrorPatterns
        patterns={patterns}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('3 unique patterns')).toBeInTheDocument();
  });

  it('should render header with "Grouped Patterns" title', () => {
    const pattern = makePattern();
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Grouped Patterns')).toBeInTheDocument();
  });

  it('should not render selected message when no pattern is selected', () => {
    const pattern = makePattern();
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.queryByText('1 pattern selected - click to view in chart & grid')).not.toBeInTheDocument();
  });

  it('should handle pattern with only errors (no warnings)', () => {
    const pattern = makePattern({
      severity: 3,
      errorCount: 10,
      warningCount: 0,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText(/warnings/)).not.toBeInTheDocument();
  });

  it('should handle pattern with only warnings (no errors)', () => {
    const pattern = makePattern({
      severity: 2,
      errorCount: 0,
      warningCount: 15,
    });
    const logs = pattern.ids.map(id => makeLog({ _id: id }));

    render(
      <ErrorPatterns
        patterns={[pattern]}
        logs={logs}
        onPatternClick={vi.fn()}
        onViewDetails={vi.fn()}
        selectedPattern={null}
      />
    );

    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.queryByText(/errors/)).not.toBeInTheDocument();
  });
});
