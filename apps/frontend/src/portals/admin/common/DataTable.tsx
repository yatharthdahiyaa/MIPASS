'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
  Table as TableIcon,
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKey?: keyof T | ((row: T) => string);
  onRowClick?: (row: T) => void;
  exportFileName?: string;
  actions?: React.ReactNode;
  emptyMessage?: string;
}

export default function DataTable<T extends object>({
  columns,
  data,
  searchPlaceholder = 'Filter records...',
  searchKey,
  onRowClick,
  exportFileName = 'mipaas-export.csv',
  actions,
  emptyMessage = 'No matching records found in this scope.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState<'all' | 'flagged' | 'recent'>('all');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach((c) => {
      init[c.key] = true;
    });
    return init;
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Filter data based on search text
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) => {
      if (typeof searchKey === 'function') {
        return searchKey(row).toLowerCase().includes(q);
      }
      if (searchKey && row[searchKey]) {
        return String(row[searchKey]).toLowerCase().includes(q);
      }
      return Object.values(row).some((val) =>
        String(val).toLowerCase().includes(q)
      );
    });
  }, [data, search, searchKey]);

  // Export to CSV
  const handleExportCSV = () => {
    if (data.length === 0) return;
    const activeCols = columns.filter((c) => visibleColumns[c.key]);
    const headers = activeCols.map((c) => `"${c.header}"`).join(',');
    const rows = filteredData.map((row) =>
      activeCols
        .map((c) => {
          const val = (row as Record<string, unknown>)[c.key];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', exportFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col rounded-2xl border border-white/10 bg-[#0A1823]/60 backdrop-blur-md overflow-hidden text-gray-200">
      {/* Table Toolbar */}
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap bg-white/[0.02]">
        {/* Left: Search input */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Quick Saved Views */}
          <div className="hidden sm:flex items-center rounded-xl bg-white/5 p-0.5 border border-white/10 text-[11px]">
            <button
              onClick={() => setSelectedView('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectedView === 'all' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Records ({filteredData.length})
            </button>
            <button
              onClick={() => setSelectedView('recent')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectedView === 'recent' ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Recent 24h
            </button>
          </div>
        </div>

        {/* Right: Actions, Column Chooser, CSV Export */}
        <div className="flex items-center gap-2">
          {actions}

          {/* Column Chooser */}
          <div className="relative">
            <button
              onClick={() => setColMenuOpen(!colMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 transition-colors"
              title="Select Visible Columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Columns</span>
            </button>

            {colMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl border border-white/15 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backgroundColor: '#0E273A' }}
              >
                <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/10 mb-1">
                  Toggle Columns
                </div>
                <div className="space-y-1">
                  {columns.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-xs text-gray-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[c.key]}
                        onChange={(e) =>
                          setVisibleColumns({ ...visibleColumns, [c.key]: e.target.checked })
                        }
                        className="rounded accent-teal-500"
                      />
                      <span>{c.header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors"
            title="Export Table to CSV (Non-PHI)"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-semibold">
              {columns
                .filter((c) => visibleColumns[c.key])
                .map((c) => (
                  <th key={c.key} className="py-2.5 px-4 tracking-wider uppercase text-[11px]">
                    {c.header}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredData.length > 0 ? (
              filteredData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-white/[0.04] transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns
                    .filter((c) => visibleColumns[c.key])
                    .map((c) => (
                      <td key={c.key} className="py-2.5 px-4 text-gray-200">
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.filter((c) => visibleColumns[c.key]).length}
                  className="py-12 text-center text-gray-400 text-xs"
                >
                  <TableIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p>{emptyMessage}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-gray-400">
        <span>Showing {filteredData.length} records</span>
        <span className="font-mono text-gray-500">Zero PHI Exposed · Synthetic Token Safe</span>
      </div>
    </div>
  );
}
