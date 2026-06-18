'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { monitoringApi } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  Activity, Plus, Search, RefreshCw, Wifi, WifiOff, Server,
  Router, Printer, Zap, Monitor, HardDrive, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock,
} from 'lucide-react';

const DEVICE_TYPE_ICONS: Record<string, React.ElementType> = {
  server: Server, switch: Router, router: Router, firewall: Monitor,
  printer: Printer, ups: Zap, ap: Wifi, storage: HardDrive,
};

const DEVICE_TYPES = ['server','switch','router','firewall','printer','ups','ap','storage','other'];

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

function AddTargetModal({ onClose, onSave }: { onClose: () => void; onSave: (d: object) => void }) {
  const [form, setForm] = useState({ name: '', host: '', device_type: 'server', vendor: '', collection_method: 'icmp', snmp_community: 'public', snmp_port: 161, interval_seconds: 300, is_enabled: true });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-5">Add Monitoring Target</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input-base w-full" placeholder="Core Switch" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Host / IP *</label>
              <input value={form.host} onChange={e => set('host', e.target.value)} className="input-base w-full" placeholder="192.168.1.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Device Type</label>
              <select value={form.device_type} onChange={e => set('device_type', e.target.value)} className="input-base w-full">
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Method</label>
              <select value={form.collection_method} onChange={e => set('collection_method', e.target.value)} className="input-base w-full">
                {['icmp','snmp','ssh','api'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          {form.collection_method === 'snmp' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Community</label>
                <input value={form.snmp_community} onChange={e => set('snmp_community', e.target.value)} className="input-base w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Port</label>
                <input type="number" value={form.snmp_port} onChange={e => set('snmp_port', +e.target.value)} className="input-base w-full" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Vendor</label>
              <input value={form.vendor} onChange={e => set('vendor', e.target.value)} className="input-base w-full" placeholder="Cisco" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Interval (sec)</label>
              <input type="number" value={form.interval_seconds} onChange={e => set('interval_seconds', +e.target.value)} className="input-base w-full" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={() => { if (form.name && form.host) onSave(form); }} className="btn-primary px-4 py-2 text-sm">Add Target</button>
        </div>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['monitoring-targets', search, filterType],
    queryFn: () => monitoringApi.listTargets({ search: search || undefined, device_type: filterType || undefined, per_page: 100 }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const { data: summary } = useQuery({
    queryKey: ['monitoring-summary'],
    queryFn: () => monitoringApi.metricsSummary().then(r => r.data),
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (body: object) => monitoringApi.createTarget(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monitoring-targets'] }); setShowAdd(false); },
  });
  const pollMut = useMutation({
    mutationFn: (id: number) => monitoringApi.pollTarget(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-targets'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => monitoringApi.deleteTarget(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-targets'] }),
  });

  const targets = data?.items ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Monitoring Targets</h1>
            <p className="text-muted-foreground text-sm mt-1">Track availability and metrics for all infrastructure devices</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4" /> Add Target
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: summary?.total ?? 0, icon: Activity, color: 'bg-indigo-600' },
            { label: 'Online', value: summary?.online ?? 0, icon: Wifi, color: 'bg-emerald-600' },
            { label: 'Offline', value: summary?.offline ?? 0, icon: WifiOff, color: 'bg-red-600' },
            { label: 'Avg Health', value: `${summary?.avg_health ?? 100}`, icon: CheckCircle2, color: 'bg-violet-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search targets…" className="input-base w-full pl-9" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-base">
            <option value="">All types</option>
            {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider grid grid-cols-[2fr_1fr_1fr_1fr_80px_100px] gap-4">
            <span>Target</span><span>Type / Method</span><span>Status</span><span>Health</span><span>Interval</span><span>Actions</span>
          </div>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 h-14 animate-pulse bg-muted/20 border-b border-border" />
            ))
          ) : targets.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No monitoring targets yet</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300">Add your first target →</button>
            </div>
          ) : (
            targets.map((t: any) => {
              const Icon = DEVICE_TYPE_ICONS[t.device_type] ?? Server;
              return (
                <div key={t.id} className="px-5 py-3 border-b border-border last:border-0 grid grid-cols-[2fr_1fr_1fr_1fr_80px_100px] gap-4 items-center hover:bg-muted/20 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.host}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{t.device_type}</span>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase">{t.collection_method}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.is_online === true && <><Wifi className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Online</span></>}
                    {t.is_online === false && <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-400">Offline</span></>}
                    {t.is_online === null && <><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Unknown</span></>}
                  </div>
                  <HealthBar score={t.health_score ?? 100} />
                  <span className="text-xs text-muted-foreground">{t.interval_seconds}s</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => pollMut.mutate(t.id)} className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground" title="Poll now">
                      <RefreshCw className={`w-3.5 h-3.5 ${pollMut.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => deleteMut.mutate(t.id)} className="p-1.5 rounded hover:bg-red-500/10 transition text-muted-foreground hover:text-red-400" title="Delete">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {showAdd && <AddTargetModal onClose={() => setShowAdd(false)} onSave={d => createMut.mutate(d)} />}
    </Layout>
  );
}
