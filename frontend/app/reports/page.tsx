'use client';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { nocApi, eventsApi, monitoringApi, printersApi } from '@/services/api';
import { FileText, Download, TrendingUp, AlertTriangle, Printer, Activity, CheckCircle2, Clock } from 'lucide-react';

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36, c = 2 * Math.PI * r, half = c / 2;
  const dash = (value / 100) * half;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="56" viewBox="0 0 96 56">
        <path d={`M 8,48 A 40,40 0 0,1 88,48`} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" strokeLinecap="round" />
        <path d={`M 8,48 A 40,40 0 0,1 88,48`} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${half}`} strokeLinecap="round" />
        <text x="48" y="50" textAnchor="middle" fontSize="14" fontWeight="800" fill={color}>{value.toFixed(1)}</text>
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function ReportsPage() {
  const { data: noc } = useQuery({ queryKey: ['noc-overview'], queryFn: () => nocApi.overview().then(r => r.data), refetchInterval: 60_000 });
  const { data: evStats } = useQuery({ queryKey: ['event-stats'], queryFn: () => eventsApi.stats().then(r => r.data), refetchInterval: 60_000 });
  const { data: monSum } = useQuery({ queryKey: ['monitoring-summary'], queryFn: () => monitoringApi.metricsSummary().then(r => r.data), refetchInterval: 60_000 });
  const { data: critical } = useQuery({ queryKey: ['printers-critical'], queryFn: () => printersApi.criticalSupplies().then(r => r.data), refetchInterval: 60_000 });
  const { data: targets } = useQuery({ queryKey: ['monitoring-targets-list'], queryFn: () => monitoringApi.listTargets({ per_page: 100 }).then(r => r.data) });

  const uptime = noc ? ((noc.targets?.online ?? 0) / Math.max(noc.targets?.total ?? 1, 1) * 100) : 0;
  const resolveRate = evStats ? (evStats.resolved / Math.max(evStats.total, 1) * 100) : 0;
  const health = noc?.avg_health ?? 100;

  const recentTargets = (targets?.items ?? []).slice(0, 8);

  function downloadCSV() {
    const rows = [
      ['Device','Host','Type','Online','Health Score','Last Polled'],
      ...(targets?.items ?? []).map((t: any) => [
        t.name, t.host, t.device_type,
        t.is_online === true ? 'Yes' : t.is_online === false ? 'No' : 'Unknown',
        t.health_score ?? 100,
        t.last_polled_at ?? 'Never',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `aii-monitoring-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">Infrastructure health summary and exportable data</p>
          </div>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Platform health gauges */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-5 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400" /> Platform Health Overview</h2>
          <div className="flex flex-wrap gap-8 justify-around">
            <Gauge value={uptime} label="Availability %" color="#10b981" />
            <Gauge value={health} label="Avg Health Score" color="#6366f1" />
            <Gauge value={resolveRate} label="Event Resolve Rate %" color="#f59e0b" />
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Activity, label: 'Total Monitored', value: monSum?.total ?? 0, sub: `${monSum?.online ?? 0} online`, color: 'bg-indigo-600' },
            { icon: AlertTriangle, label: 'Open Events', value: evStats?.open ?? 0, sub: `${evStats?.critical ?? 0} critical`, color: 'bg-amber-600' },
            { icon: Printer, label: 'Printer Alerts', value: (critical ?? []).length, sub: 'low/empty supply', color: 'bg-red-600' },
            { icon: CheckCircle2, label: 'Resolved Events', value: evStats?.resolved ?? 0, sub: 'total resolved', color: 'bg-emerald-600' },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Device breakdown */}
        {monSum?.by_device_type && Object.keys(monSum.by_device_type).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> Devices by Type</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(monSum.by_device_type).map(([type, count]: any) => (
                <div key={type} className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-2">
                  <span className="text-sm font-semibold capitalize">{type}</span>
                  <span className="text-xs bg-indigo-600/20 text-indigo-400 rounded-full px-2 py-0.5 font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical printer supplies */}
        {(critical ?? []).length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Printer className="w-4 h-4 text-red-400" />
              <h2 className="font-semibold text-sm">Critical Printer Supplies</h2>
            </div>
            <div className="divide-y divide-border">
              {(critical ?? []).slice(0, 10).map((s: any) => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{s.target_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.supply_type.replace(/_/g,' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${s.risk_level === 'empty' ? 'text-rose-400' : 'text-red-400'}`}>{s.level_percent?.toFixed(0)}%</p>
                    {s.days_remaining != null && <p className="text-xs text-muted-foreground">~{Math.round(s.days_remaining)}d left</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent targets table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Monitoring Targets</h2>
            <span className="text-xs text-muted-foreground">{targets?.total ?? 0} total</span>
          </div>
          <div className="divide-y divide-border">
            {recentTargets.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No monitoring targets</div>
            ) : recentTargets.map((t: any) => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.host} · {t.device_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.is_online === true && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Online</span>}
                  {t.is_online === false && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Offline</span>}
                  {t.is_online === null && <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">Unknown</span>}
                  <span className="text-xs text-muted-foreground w-16 text-right">{t.last_polled_at ? relTime(t.last_polled_at) : 'Never'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
