'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryApi, schedulesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { DiscoveryJob, DiscoverySchedule, DiscoveryStats, PaginatedResponse } from '@/types';
import {
  Radar, Play, Trash2, CheckCircle2, XCircle, Clock, Loader2,
  Plus, AlertTriangle, Calendar, ToggleLeft, ToggleRight,
  RefreshCw, Pencil, ChevronRight,
} from 'lucide-react';

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10',
  running:   'text-blue-400 bg-blue-400/10',
  pending:   'text-amber-400 bg-amber-400/10',
  failed:    'text-red-400 bg-red-400/10',
};
const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running:   Loader2,
  pending:   Clock,
  failed:    XCircle,
};

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'text-slate-400 bg-slate-400/10'}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function intervalLabel(minutes: number) {
  if (minutes < 60) return `Every ${minutes}m`;
  if (minutes === 60) return 'Every hour';
  if (minutes < 1440) return `Every ${minutes / 60}h`;
  if (minutes === 1440) return 'Daily';
  if (minutes === 10080) return 'Weekly';
  return `Every ${minutes}m`;
}

// ── New Discovery Modal ────────────────────────────────────────────────────────

function NewDiscoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [targets, setTargets] = useState('');
  const [name, setName]       = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => discoveryApi.start(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
      onClose(); setTargets(''); setName('');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Radar className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold">New Discovery</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); const tl = targets.split('\n').map(t => t.trim()).filter(Boolean); if (!tl.length) return; mutate({ name: name || undefined, targets: tl, methods: ['icmp','dns'] }); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Network Scan"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Targets <span className="text-red-400">*</span></label>
            <textarea value={targets} onChange={e => setTargets(e.target.value)} rows={5} required
              placeholder={"192.168.1.0/24\n10.0.0.0/24\n172.16.0.1 - 172.16.0.50"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <p className="mt-1 text-xs text-muted-foreground">One per line · CIDR, IP range, or single IP</p>
          </div>
          {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4" />{(error as any)?.response?.data?.detail || 'Failed to start'}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isPending ? 'Starting…' : 'Start Discovery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New Schedule Modal ─────────────────────────────────────────────────────────

const INTERVAL_PRESETS = [
  { label: '15 minutes',  value: 15 },
  { label: '30 minutes',  value: 30 },
  { label: '1 hour',      value: 60 },
  { label: '3 hours',     value: 180 },
  { label: '6 hours',     value: 360 },
  { label: '12 hours',    value: 720 },
  { label: '24 hours',    value: 1440 },
  { label: '1 week',      value: 10080 },
];

function ScheduleModal({
  open, onClose, schedule,
}: {
  open: boolean;
  onClose: () => void;
  schedule?: DiscoverySchedule;
}) {
  const qc = useQueryClient();
  const [name,     setName]     = useState(schedule?.name ?? '');
  const [targets,  setTargets]  = useState(schedule ? (JSON.parse(schedule.targets) as string[]).join('\n') : '');
  const [interval, setInterval] = useState(schedule?.interval_minutes ?? 60);
  const [custom,   setCustom]   = useState(!INTERVAL_PRESETS.some(p => p.value === (schedule?.interval_minutes ?? 60)));
  const [customV,  setCustomV]  = useState(String(schedule?.interval_minutes ?? 60));

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => schedule
      ? schedulesApi.update(schedule.id, data).then(r => r.data)
      : schedulesApi.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
  });

  if (!open) return null;

  const effectiveInterval = custom ? (parseInt(customV) || 60) : interval;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tl = targets.split('\n').map(t => t.trim()).filter(Boolean);
    if (!tl.length) return;
    mutate({ name, targets: tl, interval_minutes: effectiveInterval, methods: ['icmp','dns'] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold">{schedule ? 'Edit Schedule' : 'New Schedule'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Schedule Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Hourly Office Scan"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Targets <span className="text-red-400">*</span></label>
            <textarea value={targets} onChange={e => setTargets(e.target.value)} rows={4} required
              placeholder={"192.168.1.0/24\n10.0.0.1 - 10.0.0.254"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <p className="mt-1 text-xs text-muted-foreground">One per line · CIDR, range, or single IP</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Repeat Interval</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {INTERVAL_PRESETS.map(p => (
                <button type="button" key={p.value}
                  onClick={() => { setInterval(p.value); setCustom(false); }}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition ${!custom && interval === p.value ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border hover:bg-accent'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setCustom(c => !c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${custom ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted-foreground hover:bg-accent'}`}>
              Custom interval
            </button>
            {custom && (
              <div className="flex items-center gap-2 mt-2">
                <input type="number" value={customV} onChange={e => setCustomV(e.target.value)} min={1} max={525600}
                  className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            )}
          </div>
          {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4" />{(error as any)?.response?.data?.detail || 'Failed to save'}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {schedule ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Schedules Tab ──────────────────────────────────────────────────────────────

function SchedulesTab() {
  const qc = useQueryClient();
  const [showModal,   setShowModal]   = useState(false);
  const [editSchedule, setEditSchedule] = useState<DiscoverySchedule | undefined>();

  const { data: schedules = [], isLoading } = useQuery<DiscoverySchedule[]>({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.list().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: status } = useQuery<{ running: boolean; jobs: number }>({
    queryKey: ['scheduler-status'],
    queryFn: () => schedulesApi.status().then(r => r.data),
    refetchInterval: 15000,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.runNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  return (
    <>
      <ScheduleModal
        open={showModal || !!editSchedule}
        onClose={() => { setShowModal(false); setEditSchedule(undefined); }}
        schedule={editSchedule}
      />

      <div className="space-y-4">
        {/* Scheduler engine status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm text-muted-foreground">
              Scheduler engine {status?.running ? `running · ${status.jobs} active job${status.jobs !== 1 ? 's' : ''}` : 'stopped'}
            </span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>

        {/* Schedule list */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : schedules.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">No schedules yet</p>
            <p className="text-muted-foreground text-sm">Create a recurring schedule to run discovery scans automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(s => {
              const targetList: string[] = JSON.parse(s.targets);
              const isToggling = toggleMutation.isPending;
              return (
                <div key={s.id} className={`bg-card border rounded-xl p-5 transition-all ${s.is_enabled ? 'border-border' : 'border-border opacity-60'}`}>
                  <div className="flex items-start gap-4">
                    {/* Toggle */}
                    <button onClick={() => toggleMutation.mutate(s.id)} disabled={isToggling}
                      className={`mt-0.5 transition-colors flex-shrink-0 ${s.is_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'}`}>
                      {s.is_enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{s.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_enabled ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}>
                          {s.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {/* Targets */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {targetList.slice(0, 3).map(t => (
                          <span key={t} className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{t}</span>
                        ))}
                        {targetList.length > 3 && <span className="text-xs text-muted-foreground">+{targetList.length - 3} more</span>}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {intervalLabel(s.interval_minutes)}
                        </span>
                        {s.last_run_at && (
                          <span>Last run: {formatDate(s.last_run_at)}</span>
                        )}
                        {s.is_enabled && s.next_run_at && (
                          <span className="text-indigo-400">Next: {formatDate(s.next_run_at)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => runNowMutation.mutate(s.id)}
                        disabled={runNowMutation.isPending}
                        title="Run now"
                        className="p-2 rounded-lg hover:bg-indigo-400/10 text-muted-foreground hover:text-indigo-400 transition"
                      >
                        {runNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditSchedule(s)} title="Edit"
                        className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this schedule?')) deleteMutation.mutate(s.id); }}
                        className="p-2 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Jobs Tab ───────────────────────────────────────────────────────────────────

function JobsTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<DiscoveryStats>({
    queryKey: ['discovery-stats'],
    queryFn: () => discoveryApi.stats().then(r => r.data),
    refetchInterval: 5000,
  });

  const { data, isLoading } = useQuery<PaginatedResponse<DiscoveryJob>>({
    queryKey: ['discovery-jobs', page],
    queryFn: () => discoveryApi.list({ page, per_page: 20 }).then(r => r.data),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => discoveryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
    },
  });

  return (
    <>
      <NewDiscoveryModal open={showModal} onClose={() => setShowModal(false)} />

      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats?.total_jobs ?? 0, color: 'text-slate-300' },
            { label: 'Completed', value: stats?.completed ?? 0, color: 'text-emerald-400' },
            { label: 'Running', value: stats?.running ?? 0, color: 'text-blue-400' },
            { label: 'Pending', value: stats?.pending ?? 0, color: 'text-amber-400' },
            { label: 'Failed', value: stats?.failed ?? 0, color: 'text-red-400' },
            { label: 'Hosts Found', value: stats?.total_hosts_found ?? 0, color: 'text-indigo-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Discovery Jobs</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{data?.total ?? 0} total</span>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition">
                <Plus className="w-3.5 h-3.5" />New Scan
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">No jobs yet — start your first scan or create a schedule.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {['Name', 'Targets', 'Status', 'Found', 'Started', 'Duration', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map(job => {
                    const targets = job.targets ? JSON.parse(job.targets) : [];
                    const duration = job.started_at && job.finished_at
                      ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                      : null;
                    const isScheduled = job.name?.startsWith('[Scheduled]') || job.name?.startsWith('[Manual]');
                    return (
                      <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {isScheduled && <Calendar className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                            <div>
                              <p className="font-medium">{job.name || `Job #${job.id}`}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {targets.slice(0, 2).map((t: string) => (
                              <span key={t} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{t}</span>
                            ))}
                            {targets.length > 2 && <span className="text-xs text-muted-foreground">+{targets.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-emerald-400">{job.hosts_found}</span>
                          {job.hosts_scanned > 0 && <span className="text-muted-foreground text-xs"> / {job.hosts_scanned}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{job.started_at ? formatDate(job.started_at) : '—'}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {duration !== null ? `${duration}s` : job.status === 'running' ? <span className="text-blue-400">running…</span> : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(job.id); }} disabled={job.status === 'running'}
                            className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition disabled:opacity-30">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && data.pages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {data.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pages} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const [tab, setTab] = useState<'jobs' | 'schedules'>('jobs');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Discovery Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Discover, inventory, and schedule network asset scans</p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {([
            { id: 'jobs',      label: 'Jobs',      icon: Radar },
            { id: 'schedules', label: 'Schedules', icon: Calendar },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'jobs'      && <JobsTab />}
        {tab === 'schedules' && <SchedulesTab />}
      </div>
    </Layout>
  );
}
