import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Building2,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  ChevronRight,
  RotateCcw,
  X
} from 'lucide-react';
import DateInput from '../../components/common/DateInput';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

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

const FOUR_M_COLORS = {
  MAN: { bg: '#3b82f6', gradient: 'from-blue-500 to-blue-600', label: 'Man' },
  MACHINE: { bg: '#8b5cf6', gradient: 'from-purple-500 to-indigo-600', label: 'Machine' },
  METHOD: { bg: '#f59e0b', gradient: 'from-amber-400 to-amber-600', label: 'Method' },
  MATERIAL: { bg: '#10b981', gradient: 'from-emerald-400 to-emerald-600', label: 'Material' },
};

export const IhlrBarChart = ({
  stats = {},
  onSelectDepartment,
  onSelectStatus,
  currentYear = new Date().getFullYear(),
  startDate,
  endDate,
  defaultStartDate,
  defaultEndDate,
  onDateRangeChange,
}) => {
  // Dimension view tab: 'monthly' | 'department' | 'fourM' | 'shift'
  const [activeTab, setActiveTab] = useState('monthly');
  // Hovered bar anchor: { item, idx, centerX, barTopY }
  const [hoveredBar, setHoveredBar] = useState(null);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const thisYear = now.getFullYear();

  // Calculate default rolling 12 months range
  const calcDefault12Months = () => {
    const s = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-01`,
      end: `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`
    };
  };

  const defaultRange = calcDefault12Months();
  const activeDefaultStart = defaultStartDate || defaultRange.start;
  const activeDefaultEnd = defaultEndDate || defaultRange.end;

  const [localStart, setLocalStart] = useState(startDate || activeDefaultStart);
  const [localEnd, setLocalEnd] = useState(endDate || activeDefaultEnd);

  // Synchronize local state with props
  useEffect(() => {
    if (startDate !== undefined) setLocalStart(startDate);
  }, [startDate]);

  useEffect(() => {
    if (endDate !== undefined) setLocalEnd(endDate);
  }, [endDate]);

  const activeStart = startDate !== undefined ? startDate : localStart;
  const activeEnd = endDate !== undefined ? endDate : localEnd;

  const isDefault12Months = activeStart === activeDefaultStart && activeEnd === activeDefaultEnd;
  const isCurrentYear = activeStart === `${thisYear}-01-01` && activeEnd === `${thisYear}-12-31`;
  const isPrevYear = activeStart === `${thisYear - 1}-01-01` && activeEnd === `${thisYear - 1}-12-31`;

  const handleDateChange = (newStart, newEnd) => {
    setLocalStart(newStart);
    setLocalEnd(newEnd);
    if (onDateRangeChange) {
      onDateRangeChange(newStart, newEnd);
    }
  };

  const handlePreset = (presetKey) => {
    if (presetKey === 'last12') {
      handleDateChange(activeDefaultStart, activeDefaultEnd);
    } else if (presetKey === 'currentYear') {
      handleDateChange(`${thisYear}-01-01`, `${thisYear}-12-31`);
    } else if (presetKey === 'prevYear') {
      handleDateChange(`${thisYear - 1}-01-01`, `${thisYear - 1}-12-31`);
    } else if (presetKey === 'last6') {
      const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      handleDateChange(
        `${s.getFullYear()}-${pad(s.getMonth() + 1)}-01`,
        `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`
      );
    } else if (presetKey === 'last30') {
      const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      handleDateChange(
        `${past30.getFullYear()}-${pad(past30.getMonth() + 1)}-${pad(past30.getDate())}`,
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      );
    }
  };

  // Extract or compute dataset based on activeTab
  const chartData = useMemo(() => {
    if (activeTab === 'monthly') {
      const list = stats.monthlyTrend || [];
      if (list.length > 0) return list.map(item => ({ key: item.month, label: item.month, ...item }));
      // Fallback rolling 12 months with zeros
      const fallbackMonths = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mName = d.toLocaleString('en-US', { month: 'short' });
        const yrShort = String(d.getFullYear()).slice(-2);
        const label = `${mName} '${yrShort}`;
        fallbackMonths.push({ key: label, label, total: 0, open: 0, inProgress: 0, closed: 0 });
      }
      return fallbackMonths;
    }

    if (activeTab === 'department') {
      const list = stats.departmentBreakdown || [];
      if (list.length > 0) return list.map(item => ({ key: item.department, label: item.department, ...item }));
      const depts = ['PRODUCTION', 'MAINTENANCE', 'PED', 'MATERIALS', 'MARKETING', 'INCOMING QUALITY'];
      return depts.map(d => ({ key: d, label: d, total: 0, open: 0, inProgress: 0, closed: 0 }));
    }

    if (activeTab === 'fourM') {
      if (stats.fourMDetails && stats.fourMDetails.length > 0) {
        return stats.fourMDetails.map(item => ({ key: item.category, label: item.category, ...item }));
      }
      const b = stats.fourMBreakdown || {};
      return [
        { key: 'MAN', label: 'MAN', total: b.MAN || 0, open: b.MAN || 0, inProgress: 0, closed: 0 },
        { key: 'MACHINE', label: 'MACHINE', total: b.MACHINE || 0, open: b.MACHINE || 0, inProgress: 0, closed: 0 },
        { key: 'METHOD', label: 'METHOD', total: b.METHOD || 0, open: b.METHOD || 0, inProgress: 0, closed: 0 },
        { key: 'MATERIAL', label: 'MATERIAL', total: b.MATERIAL || 0, open: b.MATERIAL || 0, inProgress: 0, closed: 0 },
      ];
    }

    if (activeTab === 'shift') {
      const list = stats.shiftBreakdown || [];
      if (list.length > 0) return list.map(item => ({ key: item.shift, label: item.shift, ...item }));
      const shifts = ['Shift 1', 'Shift 2', 'Shift 3', 'General'];
      return shifts.map(s => ({ key: s, label: s, total: 0, open: 0, inProgress: 0, closed: 0 }));
    }

    return [];
  }, [activeTab, stats]);

  // Aggregate metrics
  const totalVolume = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [chartData]);

  const maxVal = useMemo(() => {
    const maxSingle = Math.max(
      ...chartData.map(d => Math.max(d.open || 0, d.inProgress || 0, d.closed || 0)),
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
    const total = stats.total || totalVolume || 0;
    if (!total) return 0;
    const closed = stats.closed || chartData.reduce((acc, curr) => acc + (curr.closed || 0), 0);
    return Math.round((closed / total) * 100);
  }, [stats, totalVolume, chartData]);

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
  // Vertically align with the top of the bar/value, clamped so it stays inside chart canvas
  const clampedPercentY = Math.max(18, Math.min(78, rawPercentY));
  // Show tooltip on right side by default; if near the extreme right canvas boundary (> 82%), flip to left
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
                  <span>IHLR Analysis Trends</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase font-mono">
                    Interactive
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Visual distribution of manufacturing line rejections by timeline, responsible department, 4M, and shifts.
              </p>
            </div>
          </div>

          {/* Dimension Selector Tabs & Bar Style Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dimension Tabs */}
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
                onClick={() => setActiveTab('fourM')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'fourM'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>4M Causes</span>
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

        {/* Embedded Date Range Filter Bar for Bar Diagram */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-3.5 pt-3.5 border-t border-slate-100/90">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>Timeline:</span>
            </span>

            <button
              type="button"
              onClick={() => handlePreset('last12')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                isDefault12Months
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 12 Months
            </button>

            <button
              type="button"
              onClick={() => handlePreset('currentYear')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                isCurrentYear
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              Year {thisYear}
            </button>

            <button
              type="button"
              onClick={() => handlePreset('last6')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                !isDefault12Months && !isCurrentYear && !isPrevYear && (activeStart && activeEnd)
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 6 Months
            </button>

            <button
              type="button"
              onClick={() => handlePreset('prevYear')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                isPrevYear
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              Year {thisYear - 1}
            </button>
          </div>

          {/* Custom Date Range Pickers Cluster */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-500 rounded-xl p-1 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <div className="w-[110px]">
                <DateInput
                  value={activeStart}
                  onChange={(e) => handleDateChange(e.target.value, activeEnd)}
                  placeholder="From Date"
                  className="w-full px-1.5 py-0.5 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none"
                />
              </div>
              <span className="text-slate-400 text-xs font-bold px-0.5 select-none">→</span>
              <div className="w-[110px]">
                <DateInput
                  value={activeEnd}
                  onChange={(e) => handleDateChange(activeStart, e.target.value)}
                  placeholder="To Date"
                  className="w-full px-1.5 py-0.5 text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 outline-none"
                />
              </div>
            </div>

            {!isDefault12Months && (
              <button
                type="button"
                onClick={() => handleDateChange(activeDefaultStart, activeDefaultEnd)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-2xs"
                title="Reset date filter to Last 12 Months"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            <span className="text-[11px] font-semibold text-slate-500 font-mono hidden sm:inline">
              ({formatDateDDMMYYYY(activeStart)} - {formatDateDDMMYYYY(activeEnd)})
            </span>
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
                {(stats.open || 0) + (stats.inProgress || 0)}
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
            <h3 className="text-sm font-bold text-slate-700">No IHLR Rejection Data for Current Filter</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Adjust your timeline or department filters above to explore rejection patterns and corrective actions.
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
                <linearGradient id="ihlr-grad-open" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#be123c" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="ihlr-grad-progress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="ihlr-grad-closed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
                </linearGradient>
                {/* 4M Dedicated Gradients */}
                <linearGradient id="ihlr-grad-man" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="ihlr-grad-machine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="ihlr-grad-method" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="ihlr-grad-material" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.8" />
                </linearGradient>
                {/* Glow Filter */}
                <filter id="bar-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
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
                const barTopY = item.total > 0 ? (baseY - maxSubH) : baseY;

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
                    {/* Invisible column hover trigger area (no visible background on hover) */}
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
                        fill="url(#ihlr-grad-open)"
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
                        fill="url(#ihlr-grad-progress)"
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
                        fill="url(#ihlr-grad-closed)"
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

            {/* Floating Tooltip positioned cleanly on the right side of the hovered bar/value */}
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
                    <span>{hoveredBar.item.label || hoveredBar.item.key}</span>
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

                {/* Pointer arrow pointing directly towards the bar/value */}
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
          <span>Hover over any bar to view status details &amp; volume breakdown</span>
        </div>
      </div>
    </div>
  );
};

export default IhlrBarChart;
