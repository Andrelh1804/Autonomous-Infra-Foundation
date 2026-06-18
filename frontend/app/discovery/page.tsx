'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { DiscoveryJob, DiscoveryStats, PaginatedResponse } from '@/types';
import {
  Radar, Play, Trash2, CheckCircle2, XCircle, Clock, Loader2,
  Plus, Eye, ChevronRight, AlertTriangle, Server
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10',
  running: 'text-blue-400 bg-blue-400/10',
  pending: 'text-amber-400 bg-amber-400/10',
  failed: 'text-red-400 bg-red-400/10',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running: Loader2,
  pending: Clock,
  failed: XCircle,
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

function NewDiscoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [targets, setTargets] = useState('');
  const [name, setName] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => discoveryApi.start(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
      onClose();
      setTargets('');
      setName('');
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetList = targets.split('\n').map(t => t.trim()).filter(Boolean);
    if (!targetList.length) return;
    mutate({ name: name || undefined, targets: targetList, methods: ['icmp', 'dns'] });
  };

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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Office Network Scan"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Targets <span className="text-red-400">*</span></label>
            <textarea
              value={targets}
              onChange={e => setTargets(e.target.value)}
              rows={5}
              placeholder={"192.168.1.0/24\n10.0.0.0/24\n172.16.0.1 - 172.16.0.50"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">One per line. Supports CIDR (192.168.1.0/24), ranges (10.0.0.1 - 10.0.0.50), or single IPs.</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {(error as any)?.response?.data?.detail || 'Failed to start discovery'}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancel</button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isPending ? 'Starting…' : 'Start Discovery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DiscoveryPage() {
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
    <Layout>
      <NewDiscoveryModal open={showModal} onClose={() => setShowModal(false)} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Discovery Center</h1>
            <p className="text-muted-foreground text-sm mt-1">Automatically discover and inventory network assets</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            New Discovery
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Total Jobs', value: stats?.total_jobs ?? 0, color: 'text-slate-400' },
            { label: 'Completed', value: stats?.completed ?? 0, color: 'text-emerald-400' },
            { label: 'Running', value: stats?.running ?? 0, color: 'text-blue-400' },
            { label: 'Pending', value: stats?.pending ?? 0, color: 'text-amber-400' },
            { label: 'Failed', value: stats?.failed ?? 0, color: 'text-red-400' },
            { label: 'Hosts Found', value: stats?.total_hosts_found ?? 0, color: 'text-indigo-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Jobs table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Discovery Jobs</h2>
            <span className="text-xs text-muted-foreground">{data?.total ?? 0} total</span>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">No discovery jobs yet. Start your first scan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Targets</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Found</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Started</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Duration</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map(job => {
                    const targets = job.targets ? JSON.parse(job.targets) : [];
                    const duration = job.started_at && job.finished_at
                      ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium">{job.name || `Job #${job.id}`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(job.created_at)}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {targets.slice(0, 2).map((t: string) => (
                              <span key={t} className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{t}</span>
                            ))}
                            {targets.length > 2 && <span className="text-xs text-muted-foreground">+{targets.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={job.status} /></td>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-emerald-400">{job.hosts_found}</span>
                          {job.hosts_scanned > 0 && <span className="text-muted-foreground"> / {job.hosts_scanned}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{job.started_at ? formatDate(job.started_at) : '—'}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {duration !== null ? `${duration}s` : job.status === 'running' ? <span className="text-blue-400 text-xs">running…</span> : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => { if (confirm('Delete this job?')) deleteMutation.mutate(job.id); }}
                            disabled={job.status === 'running'}
                            className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition disabled:opacity-30"
                          >
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
    </Layout>
  );
}
