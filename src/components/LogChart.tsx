import { useMemo, useState, useCallback } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  ReferenceArea
} from 'recharts';
import { ChartDataPoint, TimeWindow, LogEntry } from '../types';

interface LogChartProps {
  logs: LogEntry[];
  patternIds?: number[] | null;
  onBarClick: (window: TimeWindow) => void;
  selectedTimeWindow?: TimeWindow | null;
}

type TimeGranularity = '1m' | '5m' | '15m' | '30m' | '1h' | '6h' | '1d';

const GRANULARITY_OPTIONS: { value: TimeGranularity; label: string; ms: number }[] = [
  { value: '1m', label: '1 min', ms: 60 * 1000 },
  { value: '5m', label: '5 min', ms: 5 * 60 * 1000 },
  { value: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { value: '30m', label: '30 min', ms: 30 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '6h', label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '1d', label: '1 day', ms: 24 * 60 * 60 * 1000 },
];

export default function LogChart({ logs, patternIds, onBarClick, selectedTimeWindow }: LogChartProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<TimeGranularity>('5m');

  const bucketSize = useMemo(() => {
    return GRANULARITY_OPTIONS.find(g => g.value === granularity)?.ms || 5 * 60 * 1000;
  }, [granularity]);

  // Create highlighted IDs set for pattern highlighting
  const highlightedIds = useMemo(() => new Set(patternIds || []), [patternIds]);

  // Create chart data directly from logs
  const chartData = useMemo(() => {
    const logsWithTime = logs.filter(l => l._timestamp);
    if (logsWithTime.length === 0) return [];

    const buckets = new Map<number, ChartDataPoint>();

    logsWithTime.forEach(log => {
      const ts = log._timestamp!.getTime();
      const bucketTime = Math.floor(ts / bucketSize) * bucketSize;

      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, {
          time: '',
          timestamp: bucketTime,
          errors: 0,
          warnings: 0,
          info: 0,
          verbose: 0,
          total: 0,
          highlighted: 0
        });
      }

      const bucket = buckets.get(bucketTime)!;
      bucket.total++;
      if (log._severity === 3) bucket.errors++;
      else if (log._severity === 2) bucket.warnings++;
      else if (log._severity === 1) bucket.info++;
      else bucket.verbose++;

      if (highlightedIds.has(log._id)) {
        bucket.highlighted = (bucket.highlighted || 0) + 1;
      }
    });

    // Sort and format time labels
    const sorted = Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);

    let lastDay = '';
    return sorted.map(bucket => {
      const date = new Date(bucket.timestamp);
      const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const time = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Show day only when it changes
      let label: string;
      if (day !== lastDay) {
        label = `${day} ${time}`;
        lastDay = day;
      } else {
        label = time;
      }

      return {
        ...bucket,
        time: label
      };
    });
  }, [logs, bucketSize, highlightedIds]);

  // Map time labels to timestamps for selection
  const timeToTimestamp = useMemo(() => {
    const map = new Map<string, number>();
    chartData.forEach(d => map.set(d.time, d.timestamp));
    return map;
  }, [chartData]);

  // Get the time labels for the selected window
  const selectedRange = useMemo(() => {
    if (!selectedTimeWindow) return null;

    // Find the first bucket that starts at or after the window start
    let startLabel: string | null = null;
    let endLabel: string | null = null;

    for (const point of chartData) {
      if (point.timestamp >= selectedTimeWindow.start && point.timestamp < selectedTimeWindow.end) {
        if (!startLabel) startLabel = point.time;
        endLabel = point.time;
      }
    }

    return startLabel && endLabel ? { start: startLabel, end: endLabel } : null;
  }, [selectedTimeWindow, chartData]);

  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setSelecting(true);
      setSelectionStart(e.activeLabel);
      setSelectionEnd(e.activeLabel);
    }
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (selecting && e && e.activeLabel) {
      setSelectionEnd(e.activeLabel);
    }
  }, [selecting]);

  const handleMouseUp = useCallback(() => {
    if (selecting && selectionStart && selectionEnd) {
      const startTs = timeToTimestamp.get(selectionStart);
      const endTs = timeToTimestamp.get(selectionEnd);

      if (startTs !== undefined && endTs !== undefined) {
        const minTs = Math.min(startTs, endTs);
        const maxTs = Math.max(startTs, endTs);

        onBarClick({
          start: minTs,
          end: maxTs + bucketSize
        });
      }
    }

    setSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [selecting, selectionStart, selectionEnd, timeToTimestamp, bucketSize, onBarClick]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-gray-200 mb-2">{label}</p>
        <div className="space-y-1 text-xs">
          {point.highlighted !== undefined && point.highlighted > 0 && (
            <div className="flex justify-between gap-4 border-b border-gray-700 pb-1 mb-1">
              <span className="text-purple-400 font-medium">Selected Pattern</span>
              <span className="text-purple-400 font-mono font-bold">{point.highlighted}</span>
            </div>
          )}
          {point.errors > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-red-400">Errors</span>
              <span className="text-red-400 font-mono">{point.errors}</span>
            </div>
          )}
          {point.warnings > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-yellow-400">Warnings</span>
              <span className="text-yellow-400 font-mono">{point.warnings}</span>
            </div>
          )}
          {point.info > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">Info</span>
              <span className="text-blue-400 font-mono">{point.info}</span>
            </div>
          )}
          {point.verbose > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Verbose</span>
              <span className="text-gray-400 font-mono">{point.verbose}</span>
            </div>
          )}
          <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4">
            <span className="text-gray-300">Total</span>
            <span className="text-gray-300 font-mono font-medium">{point.total}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {selecting ? 'Release to select range' : 'Click or drag to filter'}
        </p>
      </div>
    );
  };

  const hasHighlights = patternIds && patternIds.length > 0 && chartData.some(d => (d.highlighted || 0) > 0);

  // Custom tick component to show day in bold
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const label = payload.value as string;
    const hasDate = label.includes(' ') && (label.includes('Jan') || label.includes('Feb') || label.includes('Mar') || label.includes('Apr') || label.includes('May') || label.includes('Jun') || label.includes('Jul') || label.includes('Aug') || label.includes('Sep') || label.includes('Oct') || label.includes('Nov') || label.includes('Dec'));

    if (hasDate) {
      const parts = label.split(' ');
      const datePart = parts.slice(0, 2).join(' ');
      const timePart = parts.slice(2).join(' ');
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={10} fontWeight="bold">
            {datePart}
          </text>
          <text x={0} y={0} dy={24} textAnchor="middle" fill="#6b7280" fontSize={9}>
            {timePart}
          </text>
        </g>
      );
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#6b7280" fontSize={10}>
          {label}
        </text>
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: 250 }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Drag to select a time range</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Granularity:</span>
            <div className="flex gap-0.5 bg-gray-800 rounded p-0.5">
              {GRANULARITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGranularity(opt.value)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    granularity === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selecting && selectionStart && selectionEnd && (
            <span className="text-xs text-blue-400">Selecting...</span>
          )}
          {selectedRange && !selecting && (
            <span className="text-xs text-blue-400">Selected: {selectedRange.start} - {selectedRange.end}</span>
          )}
        </div>
      </div>
      <ResponsiveContainer>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: hasHighlights ? 45 : 10, left: 0, bottom: 0 }}
          barCategoryGap="10%"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair select-none"
        >
          <XAxis
            dataKey="time"
            tick={<CustomXAxisTick />}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
            interval="preserveStartEnd"
            height={45}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
            width={40}
          />
          {hasHighlights && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#a855f7', fontSize: 10 }}
              axisLine={{ stroke: '#7c3aed' }}
              tickLine={{ stroke: '#7c3aed' }}
              width={40}
            />
          )}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
          <Legend
            verticalAlign="top"
            height={25}
            formatter={(value) => <span className="text-xs text-gray-400">{value}</span>}
          />

          {/* Active selection highlight (while dragging) */}
          {selecting && selectionStart && selectionEnd && (
            <ReferenceArea
              yAxisId="left"
              x1={selectionStart}
              x2={selectionEnd}
              fill="#3b82f6"
              fillOpacity={0.3}
              stroke="#3b82f6"
              strokeOpacity={0.8}
            />
          )}

          {/* Persistent selection highlight (after selection is made) */}
          {!selecting && selectedRange && (
            <ReferenceArea
              yAxisId="left"
              x1={selectedRange.start}
              x2={selectedRange.end}
              fill="#3b82f6"
              fillOpacity={0.2}
              stroke="#3b82f6"
              strokeOpacity={0.6}
              strokeDasharray="4 4"
            />
          )}

          <Bar yAxisId="left" dataKey="errors" stackId="a" fill="#ef4444" name="Errors" />
          <Bar yAxisId="left" dataKey="warnings" stackId="a" fill="#eab308" name="Warnings" />
          <Bar yAxisId="left" dataKey="info" stackId="a" fill="#3b82f6" name="Info" />
          <Bar yAxisId="left" dataKey="verbose" stackId="a" fill="#4b5563" name="Verbose" />
          {hasHighlights && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="highlighted"
              stroke="#a855f7"
              strokeWidth={3}
              dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
              name="Selected Pattern"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
