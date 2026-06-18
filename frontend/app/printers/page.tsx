'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { printersApi } from '@/services/api';
import { Printer, AlertTriangle, CheckCircle2, Search, Wifi, WifiOff, Clock } from 'lucide-react';

const SUPPLY_COLORS: Record<string, string> = {
  toner_black: 'bg-slate-600',
  toner_cyan: 'bg-cyan-500',
  toner_magenta: 'bg-pink-500',
  toner_yellow: 'bg-yellow-400',
  drum: 'bg-violet-500',
  fuser: 'bg-orange-500',
};
const RISK_COLORS: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  empty: 'text-rose-400',
};

function SupplyBar({ supply }: { supply: any }) {
  const pct = supply.level_percent ?? 0;
  const barColor = pct > 30 ? 'bg-emerald-500' : pct > 10 ? 'bg-amber-500' : 'bg-red-500';
  const bgColor = SUPPLY_COLORS[supply.supply_type] ?? 'bg-indigo-500';
  const label = supply.supply_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bgColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium truncate">{label}</span>
          <span className={`text-xs font-semibold ml-2 ${RISK_COLORS[supply.risk_level] ?? ''}`}>{pct?.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        {supply.days_remaining != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {supply.days_remaining < 1 ? 'Empty soon' : `~${Math.round(supply.days_remaining)}d remaining`}
          </p>
        )}
      </div>
    </div>
  );
}

function relTime(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function PrintersPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['printers', search],
    queryFn: () => printersApi.list({ search: search || undefined, per_page: 100 }).then(r => r.data),
    refetchInterval: 60_000,
  });
  const { data: critical } = useQuery({
    queryKey: ['printers-critical'],
    queryFn: () => printersApi.criticalSupplies().then(r => r.data),
    refetchInterval: 60_000,
  });

  const printers = data?.items ?? [];
  const critItems = critical ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Printer Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Supply levels, page counters and predictive alerts</p>
        </div>

        {/* Critical alerts banner */}
        {critItems.length > 0 && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">{critItems.length} critical supply alert{critItems.length > 1 ? 's' : ''}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {critItems.slice(0, 6).map((s: any) => (
                <div key={s.id} className="bg-card/50 border border-border rounded-lg px-3 py-2">
                  <p className="text-xs font-medium truncate">{s.target_name} — {s.supply_type.replace(/_/g,' ')}</p>
                  <p className={`text-xs font-semibold ${RISK_COLORS[s.risk_level]}`}>{s.level_percent?.toFixed(0)}% {s.days_remaining != null ? `· ~${Math.round(s.days_remaining)}d left` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{data?.total ?? 0}</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div><p className="text-xs text-muted-foreground">Online</p><p className="text-xl font-bold">{printers.filter((p: any) => p.is_online).length}</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div><p className="text-xs text-muted-foreground">Low Supply</p><p className="text-xl font-bold">{critItems.length}</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div><p className="text-xs text-muted-foreground">OK</p><p className="text-xl font-bold">{printers.filter((p: any) => p.is_online && (p.supplies ?? []).every((s: any) => s.risk_level === 'normal')).length}</p></div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search printers…" className="input-base w-full pl-9" />
        </div>

        {/* Printer grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : printers.length === 0 ? (
          <div className="py-16 text-center bg-card border border-border rounded-xl">
            <Printer className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No printers monitored</p>
            <p className="text-xs text-muted-foreground mt-1">Add a target with device type "printer"</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((p: any) => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.is_online ? 'bg-emerald-600/20' : 'bg-red-600/20'}`}>
                      <Printer className={`w-5 h-5 ${p.is_online ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.host}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {p.is_online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
                {p.supplies && p.supplies.length > 0 ? (
                  <div className="space-y-3">
                    {p.supplies.map((s: any) => <SupplyBar key={s.id} supply={s} />)}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-muted-foreground">No supply data yet — poll to collect</div>
                )}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Last polled: {relTime(p.last_polled_at)}</span>
                  {p.site_name && <span className="text-xs bg-muted px-2 py-0.5 rounded">{p.site_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
