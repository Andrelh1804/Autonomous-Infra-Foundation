'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { nocApi, eventsApi } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff,
  Clock, Shield, Zap, Printer, Server, Router, Monitor, HardDrive,
  RefreshCw, Bell,
} from 'lucide-react';

const SEV_COLOR: Record<string,string> = {
  info: 'border-l-blue-400 bg-blue-400/5',
  warning: 'border-l-amber-400 bg-amber-400/5',
  critical: 'border-l-red-400 bg-red-400/5',
  emergency: 'border-l-rose-500 bg-rose-500/8',
};
const STATUS_DOT: Record<string,string> = {
  online: 'bg-emerald-500',
  offline: 'bg-red-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-600 animate-pulse',
  unknown: 'bg-slate-500',
};
const DTYPE_ICONS: Record<string,React.ElementType> = {
  server: Server, switch: Router, router: Router,
  firewall: Monitor, printer: Printer, ups: Zap,
  ap: Wifi, storage: HardDrive,
};

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m/60)}h ago`;
}

export default function NOCPage() {
  const qc = useQueryClient();
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['noc-overview'],
    queryFn: () => nocApi.overview().then(r => r.data),
    refetchInterval: 15_000,
  });
  const { data: timeline } = useQuery({
    queryKey: ['noc-timeline'],
    queryFn: () => nocApi.timeline(24).then(r => r.data),
    refetchInterval: 15_000,
  });
  const { data: healthMap } = useQuery({
    queryKey: ['noc-health-map'],
    queryFn: () => nocApi.healthMap().then(r => r.data),
    refetchInterval: 30_000,
  });

  const ackMut = useMutation({ mutationFn: eventsApi.acknowledge, onSuccess: () => qc.invalidateQueries({ queryKey: ['noc-timeline'] }) });
  const resMut = useMutation({ mutationFn: eventsApi.resolve, onSuccess: () => qc.invalidateQueries({ queryKey: ['noc-timeline'] }) });

  const statusColor = overview?.status === 'healthy' ? 'text-emerald-400' : overview?.status === 'degraded' ? 'text-amber-400' : 'text-red-400';
  const statusBg = overview?.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20' : overview?.status === 'degraded' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const mapItems = healthMap ?? [];
  const timelineItems = (timeline ?? []).slice(0, 30);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">NOC Center</h1>
            <p className="text-muted-foreground text-sm mt-1">Network Operations Center — real-time infrastructure health</p>
          </div>
          <div className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold', statusBg, statusColor)}>
            <span className={cn('w-2 h-2 rounded-full', overview?.status === 'healthy' ? 'bg-emerald-400' : overview?.status === 'degraded' ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse')} />
            {(overview?.status ?? 'loading').toUpperCase()}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Targets', val: overview?.targets?.total ?? 0, icon: Activity, color: 'bg-indigo-600' },
            { label: 'Online', val: overview?.targets?.online ?? 0, icon: Wifi, color: 'bg-emerald-600' },
            { label: 'Offline', val: overview?.targets?.offline ?? 0, icon: WifiOff, color: 'bg-red-600' },
            { label: 'Open Events', val: overview?.events?.open ?? 0, icon: Bell, color: 'bg-amber-600' },
            { label: 'Critical', val: overview?.events?.critical ?? 0, icon: AlertTriangle, color: 'bg-red-700' },
            { label: 'Avg Health', val: `${overview?.avg_health ?? 100}`, icon: CheckCircle2, color: 'bg-violet-600' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-bold leading-tight">{val}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Health Map */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> Health Map</h2>
              <span className="text-xs text-muted-foreground">{mapItems.length} devices</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {mapItems.length === 0 ? (
                <div className="col-span-3 py-8 text-center text-muted-foreground text-sm">No targets monitored yet</div>
              ) : mapItems.map((t: any) => {
                const Icon = DTYPE_ICONS[t.device_type] ?? Server;
                return (
                  <div key={t.id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 hover:bg-muted/40 transition">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[t.status] ?? STATUS_DOT.unknown}`} />
                    <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.host}</p>
                    </div>
                    {t.open_events > 0 && (
                      <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0">{t.open_events}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event timeline */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> Event Timeline (24h)</h2>
              <button onClick={() => qc.invalidateQueries({ queryKey: ['noc-timeline'] })} className="text-muted-foreground hover:text-foreground transition p-1 rounded">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {timelineItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No events in last 24h</div>
              ) : timelineItems.map((e: any) => (
                <div key={e.id} className={cn('px-4 py-2.5 border-l-2', SEV_COLOR[e.severity] ?? SEV_COLOR.info)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {e.target_name ? `${e.target_name} · ` : ''}{relTime(e.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {e.status === 'open' && (
                        <button onClick={() => ackMut.mutate(e.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 transition">Ack</button>
                      )}
                      {e.status !== 'resolved' && (
                        <button onClick={() => resMut.mutate(e.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 transition">OK</button>
                      )}
                      {e.status === 'resolved' && <span className="text-[10px] text-emerald-400">✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
