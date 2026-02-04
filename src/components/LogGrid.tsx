import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, RowClickedEvent } from 'ag-grid-community';
import { useMemo, useRef, useCallback } from 'react';
import { LogEntry } from '../types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface LogGridProps {
  logs: LogEntry[];
  columns: string[];
  onRowClick: (log: LogEntry) => void;
}

// Try to parse and format customDimensions JSON
function formatCustomDimensions(value: string | undefined): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    const keys = Object.keys(parsed);
    if (keys.length === 0) return '';
    const highlights = keys.slice(0, 3).map(k => `${k}: ${String(parsed[k]).substring(0, 30)}`);
    return highlights.join(' | ') + (keys.length > 3 ? ` (+${keys.length - 3})` : '');
  } catch {
    return value.substring(0, 100);
  }
}

// Find column by multiple possible names
function findColumn(columns: string[], names: string[]): string | undefined {
  for (const name of names) {
    const found = columns.find(c => c.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  for (const name of names) {
    const found = columns.find(c => c.toLowerCase().includes(name.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

export default function LogGrid({ logs, columns, onRowClick }: LogGridProps) {
  const gridRef = useRef<AgGridReact>(null);

  const columnDefs = useMemo<ColDef[]>(() => {
    // Priority columns: Timestamp, Message, Custom Dimensions (row coloring shows severity)
    const cols: ColDef[] = [
      {
        field: '_timestamp',
        headerName: 'Timestamp',
        width: 175,
        sort: 'desc',
        pinned: 'left',
        valueFormatter: (params) => {
          if (!params.value) return '—';
          const date = params.value instanceof Date ? params.value : new Date(params.value);
          return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
        },
        cellStyle: { fontFamily: 'monospace', fontSize: '11px' }
      },
      {
        field: '_message',
        headerName: 'Message',
        flex: 1,
        minWidth: 400,
        cellStyle: { fontSize: '12px' },
        tooltipField: '_message'
      }
    ];

    // Find and add Custom Dimensions column
    const customDimCol = findColumn(columns, ['customDimensions', 'customdimensions', 'custom_dimensions']);
    if (customDimCol) {
      cols.push({
        field: `_raw.${customDimCol}`,
        headerName: 'Custom Dimensions',
        width: 350,
        valueGetter: (params) => params.data?._raw?.[customDimCol],
        valueFormatter: (params) => formatCustomDimensions(params.value),
        cellStyle: { fontSize: '11px', color: '#9ca3af' },
        tooltipValueGetter: (params) => {
          try {
            return JSON.stringify(JSON.parse(params.value || '{}'), null, 2);
          } catch {
            return params.value;
          }
        }
      });
    }

    return cols;
  }, [columns]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    suppressMovable: false,
  }), []);

  const onGridReady = useCallback((_params: GridReadyEvent) => {
    // Don't auto-fit, let columns use their defined widths
  }, []);

  const onRowClicked = useCallback((event: RowClickedEvent) => {
    if (event.data) {
      onRowClick(event.data);
    }
  }, [onRowClick]);

  const getRowStyle = useCallback((params: any) => {
    const severity = params.data?._severity;
    if (severity === 3) return { backgroundColor: 'rgba(127, 29, 29, 0.15)' };
    if (severity === 2) return { backgroundColor: 'rgba(113, 63, 18, 0.15)' };
    return undefined;
  }, []);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div
        className="ag-theme-alpine-dark"
        style={{ height: 'calc(100vh - 500px)', minHeight: 400, width: '100%' }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={logs}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
          rowSelection="single"
          animateRows={false}
          enableCellTextSelection={true}
          getRowStyle={getRowStyle}
          rowHeight={36}
          headerHeight={40}
          suppressCellFocus={true}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
