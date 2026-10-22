import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  ChevronRight
} from 'lucide-react';

const STATUS_COLORS = {
  open: {
    bg: '#f43f5e', // Rose 500
    gradient: 'from-rose-500 to-red-600',
    light: '#ffe4e6',
    border: '#fda4af',
    label: 'Pending',
  },
  inProgress: {
    bg: '#f59e0b', // Amber 500
    gradient: 'from-amber-400 to-amber-600',
    light: '#fef3c7',
    border: '#fcd34d',
    label: 'Awaiting Review',
  },
  closed: {
    bg: '#10b981', // Emerald 500
    gradient: 'from-emerald-400 to-emerald-600',
    light: '#d1fae5',
    border: '#6ee7b7',
    label: 'Closed',
  },
};

export const ProcessAuditBarChart = ({
  stats = {},
  requests = [],
  onSelectDepartment,
  onSelectStatus,
  currentYear = new Date().getFullYear(),
}) => {
  // Dimension view tab: 'monthly' | 'department' | 'shift'
  const [activeTab, setActiveTab] = useState('monthly');
  // Hovered bar anchor: { item, idx, centerX, barTopY }
  const [hoveredBar, setHoveredBar] = useState(null);

  const getStatusCategory = (r) => {
    const s = (r.status || '').toLowerCase();
    if (s.includes('close')) return 'closed';
    if (s.includes('pending')) return 'open';
    if (
      s.includes('progress') ||
      s.includes('signed') ||
      s.includes('review') ||
      s.includes('approval') ||
      (s.includes('approved') && !s.includes('pending'))
    ) {
      return 'inProgress';
    }
    return 'open';
  };

  const normalizeShift = (val) => {
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('night') || s.includes('3') || s === 'iii') return 'Night (Shift 3)';
    if (s.includes('even') || s.includes('2') || s === 'ii') return 'Evening (Shift 2)';
    if (s.includes('morn') || s.includes('1') || s === 'i') return 'Morning (Shift 1)';
    if (s.includes('gen')) return 'General';
    return 'General';
  };

  // Extract or compute dataset based on activeTab
  const chartData = useMemo(() => {
    const hasRequests = Array.isArray(requests) && requests.length > 0;

    if (activeTab === 'monthly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (hasRequests) {
        return months.map((m, index) => {
          const mReqs = requests.filter((r) => {
            const dVal = r.escalation_date || r.created_at || r.createdAt;
            if (!dVal) return false;
            const d = new Date(dVal);
            return !isNaN(d.getTime()) && d.getMonth() === index;
          });
          return {
            key: m,
            label: m,
            total: mReqs.length,
            open: mReqs.filter((r) => getStatusCategory(r) === 'open').length,
            inProgress: mReqs.filter((r) => getStatusCategory(r) === 'inProgress').length,
            closed: mReqs.filter((r) => getStatusCategory(r) === 'closed').length,
          };
        });
      }
      if (stats.monthlyTrend && stats.monthlyTrend.length > 0) {
        return stats.monthlyTrend.map((item) => ({ key: item.month, label: item.month, ...item }));
      }
      return months.map((m) => ({ key: m, label: m, total: 0, open: 0, inProgress: 0, closed: 0 }));
    }

    if (activeTab === 'department') {
      const defaultDepts = ['PRODUCTION', 'MAINTENANCE', 'PED', 'MATERIALS', 'MARKETING', 'INCOMING QUALITY'];
      if (hasRequests) {
        const foundDepts = requests.map((r) => (r.department || '').trim().toUpperCase()).filter(Boolean);
        const unique = Array.from(new Set([...defaultDepts, ...foundDepts]));
        return unique.map((dept) => {
          const dReqs = requests.filter((r) => (r.department || '').trim().toUpperCase() === dept);
          return {
            key: dept,
            label: dept,
            total: dReqs.length,
            open: dReqs.filter((r) => getStatusCategory(r) === 'open').length,
            inProgress: dReqs.filter((r) => getStatusCategory(r) === 'inProgress').length,
            closed: dReqs.filter((r) => getStatusCategory(r) === 'closed').length,
          };
        }).sort((a, b) => b.total - a.total);
      }
      if (stats.departmentBreakdownList && stats.departmentBreakdownList.length > 0) {
        return stats.departmentBreakdownList.map((item) => ({ key: item.department, label: item.department, ...item }));
      }
      return defaultDepts.map((d) => ({ key: d, label: d, total: 0, open: 0, inProgress: 0, closed: 0 }));
    }

    if (activeTab === 'shift') {
      const shiftList = ['Morning (Shift 1)', 'Evening (Shift 2)', 'Night (Shift 3)', 'General'];
      if (hasRequests) {
        return shiftList.map((shiftName) => {
          const sReqs = requests.filter((r) => normalizeShift(r.shift) === shiftName);
          return {
            key: shiftName,
            label: shiftName.replace(' (Shift ', '\nS').replace(')', ''),
            rawLabel: shiftName,
            total: sReqs.length,
            open: sReqs.filter((r) => getStatusCategory(r) === 'open').length,
            inProgress: sReqs.filter((r) => getStatusCategory(r) === 'inProgress').length,
            closed: sReqs.filter((r) => getStatusCategory(r) === 'closed').length,
          };
        });
      }
      if (stats.shiftBreakdown && stats.shiftBreakdown.length > 0) {
        return stats.shiftBreakdown.map((item) => ({ key: item.shift, label: item.shift, ...item }));
      }
      return shiftList.map((s) => ({ key: s, label: s, total: 0, open: 0, inProgress: 0, closed: 0 }));
    }

    return [];
  }, [activeTab, requests, stats]);

  // Aggregate metrics
  const totalVolume = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [chartData]);

  const maxVal = useMemo(() => {
    const maxSingle = Math.max(
      ...chartData.map((d) => Math.max(d.open || 0, d.inProgress || 0, d.closed || 0)),
      1
    );
    return Math.ceil(maxSingle * 1.2) || 5;
  }, [chartData]);

  // Peak category
  const peakItem = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return [...chartData].sort((a, b) => (b.total || 0) - (a.total || 0))[0];
  }, [chartData]);

  // Closure rate
  const closureRate = useMemo(() => {
    const total = totalVolume || stats.totalRequests || stats.total || 0;
    if (!total) return 0;
    const closed = chartData.reduce((acc, curr) => acc + (curr.closed || 0), 0);
    return Math.round((closed / total) * 100);
  }, [totalVolume, chartData, stats]);

  // Pending Review total
  const pendingReviewTotal = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + (curr.open || 0) + (curr.inProgress || 0), 0);
  }, [chartData]);

  // SVG Chart Dimensions
  const svgWidth = 860;
  const svgHeight = 270;
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 32;
  const paddingBottom = 42;

  const innerWidth = svgWidth - paddingLeft - paddingRight;
  const innerHeight = svgHeight - paddingTop - paddingBottom;

  const numItems = chartData.length;
  const slotWidth = numItems > 0 ? innerWidth / numItems : innerWidth;
  const maxBarWidth = activeTab === 'monthly' ? 38 : 52;
  const barWidth = Math.min(slotWidth * 0.65, maxBarWidth);

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.66), maxVal];

  const percentX = hoveredBar ? (hoveredBar.centerX / svgWidth) * 100 : 50;
  const rawPercentY = hoveredBar ? (hoveredBar.barTopY / svgHeight) * 100 : 50;
  const clampedPercentY = Math.max(18, Math.min(78, rawPercentY));
  const showOnRight = percentX <= 82;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-300">
      {/* Top Header & Tab Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100/90 bg-gradient-to-r from-slate-50/70 via-white to-blue-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 ring-4 ring-blue-50 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Process Audit Observation Trends</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase font-mono">
                    Interactive
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Visual distribution of shopfloor audit observations by timeline, responsible department, and shifts.
              </p>
            </div>
          </div>

          {/* Dimension Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('monthly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'monthly'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('department')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'department'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Department</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shift')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'shift'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Shift</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Analytical Highlights Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3.5 border-t border-slate-100">
          <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume</span>
              <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{totalVolume}</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Closure Rate</span>
              <div className="text-lg font-black text-emerald-600 font-mono mt-0.5">{closureRate}%</div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Category</span>
              <div className="text-sm font-black text-slate-800 truncate mt-0.5">
                {peakItem ? `${peakItem.label} (${peakItem.total})` : 'None'}
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
              <div className="text-lg font-black text-rose-600 font-mono mt-0.5">
                {pendingReviewTotal}
              </div>
            </div>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="p-4 sm:p-6 relative select-none">
        {totalVolume === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Process Audit Data for Current Filter</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Adjust your timeline or department filters above to explore shopfloor audit observation patterns and corrective actions.
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[620px] overflow-visible"
            >
              {/* Defs for Gradients & Drop Shadows */}
              <defs>
                <linearGradient id="pa-grad-open" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#be123c" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="pa-grad-progress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="pa-grad-closed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Gridlines & Y-Axis Labels */}
              {yTicks.map((val, idx) => {
                const yPos = paddingTop + innerHeight - (val / maxVal) * innerHeight;
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={svgWidth - paddingRight}
                      y2={yPos}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray={val === 0 ? '0' : '4 4'}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={yPos + 3.5}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Data Bars (Grouped: Pending, Awaiting Review, Closed side-by-side) */}
              {chartData.map((item, idx) => {
                const centerX = paddingLeft + idx * slotWidth + slotWidth / 2;
                const isHovered = hoveredBar && hoveredBar.item.key === item.key;

                const subBarWidth = Math.max((barWidth - 4) / 3, 6);
                const baseY = paddingTop + innerHeight;

                const openH = ((item.open || 0) / maxVal) * innerHeight;
                const progH = ((item.inProgress || 0) / maxVal) * innerHeight;
                const closedH = ((item.closed || 0) / maxVal) * innerHeight;

                const maxSubH = Math.max(openH, progH, closedH);
                const barTopY = item.total > 0 ? baseY - maxSubH : baseY;

                const openX = centerX - barWidth / 2;
                const progX = openX + subBarWidth + 2;
                const closedX = progX + subBarWidth + 2;

                return (
                  <g
                    key={item.key || idx}
                    onMouseEnter={() =>
                      setHoveredBar({
                        item,
                        idx,
                        centerX,
                        barTopY: Math.max(barTopY, paddingTop + 8),
                      })
                    }
                    onMouseLeave={() => setHoveredBar(null)}
                    onClick={() => {
                      if (activeTab === 'department' && onSelectDepartment) {
                        onSelectDepartment(item.key);
                      }
                    }}
                    className="cursor-pointer transition-all duration-200"
                  >
                    {/* Invisible column hover trigger area */}
                    <rect
                      x={centerX - slotWidth / 2 + 2}
                      y={paddingTop}
                      width={slotWidth - 4}
                      height={innerHeight}
                      fill="transparent"
                    />

                    {/* Sub-bar: Pending (Rose) */}
                    {openH > 0 && (
                      <rect
                        x={openX}
                        y={baseY - openH}
                        width={subBarWidth}
                        height={openH}
                        fill="url(#pa-grad-open)"
                        rx="3"
                      />
                    )}

                    {/* Sub-bar: Awaiting Review (Amber) */}
                    {progH > 0 && (
                      <rect
                        x={progX}
                        y={baseY - progH}
                        width={subBarWidth}
                        height={progH}
                        fill="url(#pa-grad-progress)"
                        rx="3"
                      />
                    )}

                    {/* Sub-bar: Closed (Emerald) */}
                    {closedH > 0 && (
                      <rect
                        x={closedX}
                        y={baseY - closedH}
                        width={subBarWidth}
                        height={closedH}
                        fill="url(#pa-grad-closed)"
                        rx="3"
                      />
                    )}

                    {/* Top Value Counter if total > 0 */}
                    {item.total > 0 && (
                      <text
                        x={centerX}
                        y={barTopY - 6}
                        textAnchor="middle"
                        fill={isHovered ? '#1e293b' : '#64748b'}
                        fontSize="10"
                        fontWeight="800"
                        className="font-mono transition-colors"
                      >
                        {item.total}
                      </text>
                    )}

                    {/* Empty Placeholder indicator for zero values */}
                    {item.total === 0 && (
                      <circle
                        cx={centerX}
                        cy={baseY - 4}
                        r="2.5"
                        fill="#cbd5e1"
                      />
                    )}

                    {/* X-Axis Label */}
                    <text
                      x={centerX}
                      y={paddingTop + innerHeight + 18}
                      textAnchor="middle"
                      fill={isHovered ? '#2563eb' : '#64748b'}
                      fontSize={activeTab === 'department' ? '9.5' : '10'}
                      fontWeight={isHovered ? '800' : '700'}
                    >
                      {item.label && item.label.length > 9
                        ? `${item.label.substring(0, 8)}…`
                        : item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip positioned cleanly on the side of the hovered bar/value */}
            {hoveredBar && (
              <div
                className={`absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/80 min-w-[210px] transition-all duration-150 animate-in fade-in zoom-in-95 select-none -translate-y-1/2 ${
                  showOnRight ? '' : '-translate-x-full'
                }`}
                style={{
                  left: showOnRight
                    ? `calc(${percentX}% + ${barWidth / 2 + 12}px)`
                    : `calc(${percentX}% - ${barWidth / 2 + 12}px)`,
                  top: `${clampedPercentY}%`,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-700/80">
                  <span className="font-extrabold text-xs text-white uppercase tracking-tight flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>{hoveredBar.item.rawLabel || hoveredBar.item.label || hoveredBar.item.key}</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                    {hoveredBar.item.total} total
                  </span>
                </div>

                {/* Breakdown List */}
                <div className="space-y-1.5 pt-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" />
                      <span>Pending Action</span>
                    </span>
                    <span className="font-mono font-bold text-rose-300">{hoveredBar.item.open || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs" />
                      <span>Awaiting Review</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300">{hoveredBar.item.inProgress || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                      <span>Closed &amp; Verified</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300">{hoveredBar.item.closed || 0}</span>
                  </div>
                </div>

                {totalVolume > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Share of Total:</span>
                    <span className="font-bold font-mono text-blue-300">
                      {Math.round(((hoveredBar.item.total || 0) / totalVolume) * 100)}%
                    </span>
                  </div>
                )}

                {/* Pointer arrow */}
                {showOnRight ? (
                  <div
                    className="absolute right-full top-1/2 -mr-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-slate-900 border-l border-b border-slate-700/80 rotate-45 pointer-events-none"
                  />
                ) : (
                  <div
                    className="absolute left-full top-1/2 -ml-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-slate-900 border-r border-t border-slate-700/80 rotate-45 pointer-events-none"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Interactive Legend */}
      <div className="p-3.5 sm:p-4 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Legend:</span>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500 shadow-2xs" />
            <span className="font-semibold text-slate-700">Pending (Open)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500 shadow-2xs" />
            <span className="font-semibold text-slate-700">Awaiting Review</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-2xs" />
            <span className="font-semibold text-slate-700">Closed (Signed-off)</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Hover over any bar to view status details &amp; volume breakdown • Click department to filter</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessAuditBarChart;
