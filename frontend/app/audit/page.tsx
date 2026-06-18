'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import { Search, Filter, RotateCcw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { AuditLog, PaginatedResponse } from '@/types';

const ACTION_COLORS: Record<string, string> = {
  LOGIN:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  LOGOUT:  'bg-slate-500/15 text-slate-400 border-slate-500/20',
  CREATE:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  UPDATE:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  DELETE:  'bg-red-500/15 text-red-400 border-red-500/20',
  DEFAULT: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action.toUpperCase()] ?? ACTION_COLORS.DEFAULT;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border ${cls}`}>
      {action}
    </span>
  );
}

function ModuleBadge({ module }: { module: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-card border border-border text-muted-foreground capitalize">
      {module}
    </span>
  );
}

const PER_PAGE = 25;

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    module: '',
    user_email: '',
    date_from: '',
    date_to: '',
  });
  const [applied, setApplied] = useState(filters);

  const { data: meta } = useQuery<{ modules: string[]; actions: string[] }>({
    queryKey: ['audit-meta'],
    queryFn: () => auditApi.meta().then(r => r.data),
    staleTime: 60_000,
  });

  const params = {
    page,
    per_page: PER_PAGE,
    ...(applied.action     && { action: applied.action }),
    ...(applied.module     && { module: applied.module }),
    ...(applied.user_email && { user_email: applied.user_email }),
    ...(applied.date_from  && { date_from: applied.date_from }),
    ...(applied.date_to    && { date_to: applied.date_to + 'T23:59:59' }),
  };

  const { data, isFetching } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params).then(r => r.data),
    placeholderData: prev => prev,
  });

  const applyFilters = useCallback(() => {
    setApplied(filters);
    setPage(1);
  }, [filters]);

  const resetFilters = useCallback(() => {
    const blank = { action: '', module: '', user_email: '', date_from: '', date_to: '' };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  }, []);

  const hasActiveFilters = Object.values(applied).some(Boolean);
  const totalPages = data?.pages ?? 1;

  function downloadCSV() {
    if (!data?.items?.length) return;
    const header = ['ID', 'User', 'Action', 'Module', 'IP Address', 'Timestamp'];
    const rows = data.items.map(l => [
      l.id, l.user_email ?? '', l.action, l.module, l.ip_address ?? '', l.created_at
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-page${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.total.toLocaleString()} events recorded` : 'System activity trail'}
            </p>
          </div>
          <button
            onClick={downloadCSV}
            disabled={!data?.items?.length}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs">active</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* User email search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-muted-foreground"
                placeholder="Search by user email…"
                value={filters.user_email}
                onChange={e => setFilters(p => ({ ...p, user_email: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
            </div>

            {/* Action */}
            <select
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
              value={filters.action}
              onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
            >
              <option value="">All Actions</option>
              {(meta?.actions ?? []).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Module */}
            <select
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
              value={filters.module}
              onChange={e => setFilters(p => ({ ...p, module: e.target.value }))}
            >
              <option value="">All Modules</option>
              {(meta?.modules ?? []).map(m => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>

            {/* Date from */}
            <input
              type="date"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
              value={filters.date_from}
              onChange={e => setFilters(p => ({ ...p, date_from: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Date to */}
            <input
              type="date"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
              value={filters.date_to}
              onChange={e => setFilters(p => ({ ...p, date_to: e.target.value }))}
            />
            <div className="flex gap-2 sm:col-span-1 lg:col-span-4 lg:justify-end">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition text-muted-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium"
              >
                <Search className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`bg-card border border-border rounded-xl overflow-hidden transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['#', 'User', 'Action', 'Module', 'IP Address', 'Payload', 'Timestamp'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!data ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${50 + (j * 13) % 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <ScrollText className="w-8 h-8 opacity-30" />
                        No audit events match your filters
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.items.map(log => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                            {log.user_email?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm truncate max-w-[160px]" title={log.user_email ?? undefined}>
                            {log.user_email || <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><ActionBadge action={log.action} /></td>
                      <td className="px-4 py-3 whitespace-nowrap"><ModuleBadge module={log.module} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.payload ? (
                          <span className="text-xs text-muted-foreground truncate block font-mono" title={log.payload}>
                            {log.payload.length > 60 ? log.payload.slice(0, 60) + '…' : log.payload}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, data.total)}</span> of <span className="font-medium text-foreground">{data.total.toLocaleString()}</span> events
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                        p === page
                          ? 'bg-indigo-600 text-white'
                          : 'border border-border hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}

function ScrollText(props: { className?: string }) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
