import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterBar from './FilterBar';
import { FilterState, ErrorPattern } from '../types';

// =============================================================================
// Helper: create a FilterState for tests
// =============================================================================
function makeFilterState(overrides: Partial<FilterState> = {}): FilterState {
  return {
    timeWindow: null,
    severities: [0, 1, 2, 3, 4],
    searchText: '',
    searchColumn: '_all',
    patternIds: null,
    serverRoles: ['CM', 'CD', 'XP', 'Other'],
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
// FilterBar Component Tests
// =============================================================================
describe('FilterBar', () => {
  it('should render all severity toggle buttons', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Verbose')).toBeInTheDocument();
  });

  it('should call onSeverityToggle when severity button clicked', () => {
    const filters = makeFilterState();
    const onSeverityToggle = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={onSeverityToggle}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const errorButton = screen.getByText('Error');
    fireEvent.click(errorButton);

    expect(onSeverityToggle).toHaveBeenCalledWith(3);
    expect(onSeverityToggle).toHaveBeenCalledTimes(1);
  });

  it('should render server role buttons when hasCustomDimensions is true', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={true}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('CM')).toBeInTheDocument();
    expect(screen.getByText('CD')).toBeInTheDocument();
    expect(screen.getByText('XP')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('Server Role:')).toBeInTheDocument();
  });

  it('should not render server role buttons when hasCustomDimensions is false', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.queryByText('Server Role:')).not.toBeInTheDocument();
    expect(screen.queryByText('CM')).not.toBeInTheDocument();
    expect(screen.queryByText('CD')).not.toBeInTheDocument();
  });

  it('should call onServerRoleToggle when server role button clicked', () => {
    const filters = makeFilterState();
    const onServerRoleToggle = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={true}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={onServerRoleToggle}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const cmButton = screen.getByText('CM');
    fireEvent.click(cmButton);

    expect(onServerRoleToggle).toHaveBeenCalledWith('CM');
    expect(onServerRoleToggle).toHaveBeenCalledTimes(1);
  });

  it('should render search input with correct value', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput="test search query"
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search logs...') as HTMLInputElement;
    expect(searchInput.value).toBe('test search query');
  });

  it('should call onSearchInputChange when typing in search', () => {
    const filters = makeFilterState();
    const onSearchInputChange = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={onSearchInputChange}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'new query' } });

    expect(onSearchInputChange).toHaveBeenCalledWith('new query');
    expect(onSearchInputChange).toHaveBeenCalledTimes(1);
  });

  it('should show time filter tag when timeWindow exists', () => {
    const filters = makeFilterState({
      timeWindow: { start: 1000, end: 2000 },
    });

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('Time filtered')).toBeInTheDocument();
  });

  it('should not show time filter tag when timeWindow is null', () => {
    const filters = makeFilterState({ timeWindow: null });

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.queryByText('Time filtered')).not.toBeInTheDocument();
  });

  it('should call onTimeWindowClear when time filter clear button is clicked', () => {
    const filters = makeFilterState({
      timeWindow: { start: 1000, end: 2000 },
    });
    const onTimeWindowClear = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={onTimeWindowClear}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const clearButton = screen.getByText('✕');
    fireEvent.click(clearButton);

    expect(onTimeWindowClear).toHaveBeenCalledTimes(1);
  });

  it('should show pattern filter tag when selectedPattern exists', () => {
    const filters = makeFilterState();
    const pattern = makePattern({ count: 25 });

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={pattern}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('Pattern: 25 entries')).toBeInTheDocument();
  });

  it('should not show pattern filter tag when selectedPattern is null', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.queryByText(/Pattern:/)).not.toBeInTheDocument();
  });

  it('should call onClearPatternFilter when pattern filter clear button is clicked', () => {
    const filters = makeFilterState();
    const pattern = makePattern({ count: 25 });
    const onClearPatternFilter = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={pattern}
        onClearPatternFilter={onClearPatternFilter}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    // Find the ✕ button inside the pattern filter tag
    const patternTag = screen.getByText('Pattern: 25 entries').parentElement;
    const clearButton = patternTag!.querySelector('button');
    fireEvent.click(clearButton!);

    expect(onClearPatternFilter).toHaveBeenCalledTimes(1);
  });

  it('should call onClearFilters when "Clear all" clicked', () => {
    const filters = makeFilterState();
    const onClearFilters = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={onClearFilters}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('should render Export CSV button with filtered count', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={1234}
      />
    );

    expect(screen.getByText('Export CSV (1,234)')).toBeInTheDocument();
  });

  it('should call onExport when Export CSV button is clicked', () => {
    const filters = makeFilterState();
    const onExport = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={onExport}
        filteredCount={100}
      />
    );

    const exportButton = screen.getByText(/Export CSV/);
    fireEvent.click(exportButton);

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('should render "Load new file" button', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('Load new file')).toBeInTheDocument();
  });

  it('should call onFileInput when file is selected', () => {
    const filters = makeFilterState();
    const onFileInput = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={onFileInput}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const fileInput = screen.getByText('Load new file').parentElement!.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(onFileInput).toHaveBeenCalledTimes(1);
  });

  it('should render search column dropdown with correct value', () => {
    const filters = makeFilterState({ searchColumn: 'message' });

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all', 'message', 'timestamp']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const select = screen.getByDisplayValue('message') as HTMLSelectElement;
    expect(select.value).toBe('message');
  });

  it('should call onSearchColumnChange when column is changed', () => {
    const filters = makeFilterState({ searchColumn: '_all' });
    const onSearchColumnChange = vi.fn();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all', 'message', 'timestamp']}
        onSearchColumnChange={onSearchColumnChange}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const select = screen.getByDisplayValue('All Columns');
    fireEvent.change(select, { target: { value: 'message' } });

    expect(onSearchColumnChange).toHaveBeenCalledWith('message');
    expect(onSearchColumnChange).toHaveBeenCalledTimes(1);
  });

  it('should render all column options in dropdown', () => {
    const filters = makeFilterState();

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all', 'message', 'timestamp', 'severity']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    expect(screen.getByText('All Columns')).toBeInTheDocument();
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('timestamp')).toBeInTheDocument();
    expect(screen.getByText('severity')).toBeInTheDocument();
  });

  it('should show active styling for selected severities', () => {
    const filters = makeFilterState({ severities: [3] }); // Only Error selected

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={[3]}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={false}
        serverRoles={filters.serverRoles}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const errorButton = screen.getByText('Error');
    expect(errorButton).toHaveClass('bg-red-900/50', 'text-red-400');
  });

  it('should show active styling for selected server roles', () => {
    const filters = makeFilterState({ serverRoles: ['CM'] }); // Only CM selected

    render(
      <FilterBar
        filters={filters}
        searchInput=""
        onSearchInputChange={vi.fn()}
        severities={filters.severities}
        onSeverityToggle={vi.fn()}
        hasCustomDimensions={true}
        serverRoles={['CM']}
        onServerRoleToggle={vi.fn()}
        columns={['_all']}
        onSearchColumnChange={vi.fn()}
        onTimeWindowClear={vi.fn()}
        selectedPattern={null}
        onClearPatternFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onFileInput={vi.fn()}
        onExport={vi.fn()}
        filteredCount={100}
      />
    );

    const cmButton = screen.getByText('CM');
    expect(cmButton).toHaveClass('bg-blue-900/50', 'text-blue-400');
  });
});
