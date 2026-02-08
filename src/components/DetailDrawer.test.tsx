import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DetailDrawer from './DetailDrawer';
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
// DetailDrawer Component Tests
// =============================================================================
describe('DetailDrawer', () => {
  it('should return null when log is null', () => {
    const { container } = render(
      <DetailDrawer
        log={null}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render log details when log is provided', () => {
    const log = makeLog({
      _id: 1,
      _message: 'Test log message',
      _severity: 3,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Log Details')).toBeInTheDocument();
    expect(screen.getByText('Test log message')).toBeInTheDocument();
  });

  it('should display timestamp in correct format', () => {
    const timestamp = new Date('2024-01-15T14:30:45Z');
    const log = makeLog({
      _id: 1,
      _timestamp: timestamp,
      _severity: 1,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    // Check for date components (format: "Mon, 2024, Jan, 15, 14:30:45")
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/Jan/)).toBeInTheDocument();
  });

  it('should display the log message', () => {
    const log = makeLog({
      _id: 1,
      _message: 'Connection timeout after 5000ms',
      _severity: 3,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout after 5000ms')).toBeInTheDocument();
  });

  it('should display severity label and color badge for Error', () => {
    const log = makeLog({
      _id: 1,
      _severity: 3,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should display severity label and color badge for Warning', () => {
    const log = makeLog({
      _id: 1,
      _severity: 2,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should display severity label and color badge for Info', () => {
    const log = makeLog({
      _id: 1,
      _severity: 1,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('should display severity label and color badge for Verbose', () => {
    const log = makeLog({
      _id: 1,
      _severity: 0,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Verbose')).toBeInTheDocument();
  });

  it('should display severity label and color badge for Critical', () => {
    const log = makeLog({
      _id: 1,
      _severity: 4,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('should render all raw fields', () => {
    const log = makeLog({
      _id: 1,
      _severity: 1,
      _raw: {
        customField1: 'value1',
        customField2: 'value2',
        customField3: 'value3',
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('All Fields')).toBeInTheDocument();
    expect(screen.getByText('customField1')).toBeInTheDocument();
    expect(screen.getByText('customField2')).toBeInTheDocument();
    expect(screen.getByText('customField3')).toBeInTheDocument();
    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('value2')).toBeInTheDocument();
    expect(screen.getByText('value3')).toBeInTheDocument();
  });

  it('should format JSON values in raw fields', () => {
    const log = makeLog({
      _id: 1,
      _severity: 1,
      _raw: {
        jsonField: '{"key": "value", "nested": {"foo": "bar"}}',
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('jsonField')).toBeInTheDocument();
    // The JSON should be formatted with indentation
    const formatted = screen.getByText(/"key": "value"/);
    expect(formatted).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const log = makeLog({ _id: 1 });
    const onClose = vi.fn();

    render(
      <DetailDrawer
        log={log}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' }); // SVG button
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const log = makeLog({ _id: 1 });
    const onClose = vi.fn();

    const { container } = render(
      <DetailDrawer
        log={log}
        onClose={onClose}
      />
    );

    const backdrop = container.querySelector('.bg-black\\/60');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show Operation ID section when _operationId exists', () => {
    const log = makeLog({
      _id: 1,
      _operationId: '550e8400-e29b-41d4-a716-446655440000',
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Operation ID')).toBeInTheDocument();
    expect(screen.getByText('550e8400-e29b-41d4-a716-446655440000')).toBeInTheDocument();
  });

  it('should not show Operation ID section when _operationId is missing', () => {
    const log = makeLog({
      _id: 1,
      _operationId: undefined,
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Operation ID')).not.toBeInTheDocument();
  });

  it('should call onOperationIdClick when "Show related logs" clicked', () => {
    const log = makeLog({
      _id: 1,
      _operationId: 'test-operation-id',
    });
    const onOperationIdClick = vi.fn();

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
        onOperationIdClick={onOperationIdClick}
      />
    );

    const button = screen.getByText('Show related logs');
    fireEvent.click(button);

    expect(onOperationIdClick).toHaveBeenCalledWith('test-operation-id');
    expect(onOperationIdClick).toHaveBeenCalledTimes(1);
  });

  it('should not show "Show related logs" button when onOperationIdClick is not provided', () => {
    const log = makeLog({
      _id: 1,
      _operationId: 'test-operation-id',
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Show related logs')).not.toBeInTheDocument();
  });

  it('should have a "Copy JSON" button', () => {
    const log = makeLog({
      _id: 1,
      _raw: { field1: 'value1' },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Copy JSON')).toBeInTheDocument();
  });

  it('should copy JSON to clipboard when "Copy JSON" is clicked', () => {
    const log = makeLog({
      _id: 1,
      _raw: { field1: 'value1', field2: 'value2' },
    });

    const clipboardWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    const copyButton = screen.getByText('Copy JSON');
    fireEvent.click(copyButton);

    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    const copiedData = clipboardWriteText.mock.calls[0][0];
    expect(copiedData).toContain('field1');
    expect(copiedData).toContain('value1');
    expect(copiedData).toContain('field2');
    expect(copiedData).toContain('value2');
  });

  it('should display entry ID in footer', () => {
    const log = makeLog({ _id: 42 });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Entry ID: 42')).toBeInTheDocument();
  });

  it('should handle raw fields with null values (should be filtered out)', () => {
    const log = makeLog({
      _id: 1,
      _raw: {
        field1: 'value1',
        field2: null as unknown as string,
        field3: 'value3',
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('field1')).toBeInTheDocument();
    expect(screen.queryByText('field2')).not.toBeInTheDocument();
    expect(screen.getByText('field3')).toBeInTheDocument();
  });

  it('should handle raw fields with undefined values (should be filtered out)', () => {
    const log = makeLog({
      _id: 1,
      _raw: {
        field1: 'value1',
        field2: undefined as unknown as string,
        field3: 'value3',
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('field1')).toBeInTheDocument();
    expect(screen.queryByText('field2')).not.toBeInTheDocument();
    expect(screen.getByText('field3')).toBeInTheDocument();
  });

  it('should handle raw fields with empty string values (should be filtered out)', () => {
    const log = makeLog({
      _id: 1,
      _raw: {
        field1: 'value1',
        field2: '',
        field3: 'value3',
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('field1')).toBeInTheDocument();
    expect(screen.queryByText('field2')).not.toBeInTheDocument();
    expect(screen.getByText('field3')).toBeInTheDocument();
  });

  it('should handle long field values (should display in code block)', () => {
    const longValue = 'A'.repeat(100);
    const log = makeLog({
      _id: 1,
      _raw: {
        longField: longValue,
      },
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('longField')).toBeInTheDocument();
    expect(screen.getByText(longValue)).toBeInTheDocument();
  });

  it('should not display timestamp section when _timestamp is null', () => {
    const log = makeLog({
      _id: 1,
      _timestamp: null,
      _message: 'No timestamp',
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();
  });

  it('should not display message section when _message is empty', () => {
    const log = makeLog({
      _id: 1,
      _message: '',
    });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Message')).not.toBeInTheDocument();
  });

  it('should render backdrop with correct styling classes', () => {
    const log = makeLog({ _id: 1 });

    const { container } = render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    const backdrop = container.querySelector('.bg-black\\/60.backdrop-blur-sm');
    expect(backdrop).toBeTruthy();
  });

  it('should render drawer with correct styling classes', () => {
    const log = makeLog({ _id: 1 });

    render(
      <DetailDrawer
        log={log}
        onClose={vi.fn()}
      />
    );

    // Check for drawer structure
    expect(screen.getByText('Log Details').closest('div')).toHaveClass('flex', 'items-center', 'gap-3');
  });
});
