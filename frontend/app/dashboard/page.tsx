'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import type { DashboardStats } from '@/types';
import {
  Building2, Users, Activity, CheckCircle2,
  Radar, Server, CalendarClock, TrendingUp,
  Clock, XCircle, Play, AlertTriangle, Zap,
} from 'lucide-react';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  const W = 200, H = 48, PAD = 4;
  const max = Math.max(...data, 1);
  const min = 0;
  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / (max - min)) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;
  const allZero = data.every(v => v === 0);

  if (allZero) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
    );
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity={i === pts.length - 1 ? 1 : 0.4} />
      ))}
    </svg>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function relFuture(iso: string | null): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

// ── Discovery Health Widget ───────────────────────────────────────────────────

interface HealthData {
  total_assets: number;
  active_schedules: number;
  next_run_at: string | null;
  last_job: {
    id: number; name: string; status: string;
    hosts_found: number; finished_at: string;
  } | null;
  daily_assets_found: { date: string; hosts_found: number }[];
  jobs_last_7d: { completed: number; failed: number; running: number; total: number };
}

function DiscoveryHealthWidget() {
  const { data, isLoading } = useQuery<HealthData>({
    queryKey: ['discovery-health'],
    queryFn: () => dashboardApi.discoveryHealth().then(r => r.data),
    refetchInterval: 30_000,
  });

  const sparkValues = (data?.daily_assets_found ?? Array(7).fill({ hosts_found: 0 }))
    .map(d => d.hosts_found);
  const totalFound7d = sparkValues.reduce((a, b) => a + b, 0);
  const lastJobOk = data?.last_job?.status === 'completed';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Radar className="w-4 h-4 text-indigo-400" />
            Discovery Health
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time view of your network scanning engine</p>
        </div>
        <Link href="/discovery"
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition">
          Open Discovery →
        </Link>
      </div>

      {isLoading ? (
        <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
            {/* Total assets */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-muted-foreground font-medium">Total Assets</span>
              </div>
              <p className="text-2xl font-bold">{(data?.total_assets ?? 0).toLocaleString()}</p>
              <Link href="/assets" className="text-xs text-indigo-400 hover:underline mt-0.5 inline-block">
                View CMDB
              </Link>
            </div>

            {/* Active schedules */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-muted-foreground font-medium">Active Schedules</span>
              </div>
              <p className="text-2xl font-bold">{data?.active_schedules ?? 0}</p>
              {data?.next_run_at
                ? <p className="text-xs text-emerald-400 mt-0.5">Next: {relFuture(data.next_run_at)}</p>
                : <p className="text-xs text-muted-foreground mt-0.5">No upcoming runs</p>
              }
            </div>

            {/* Last scan */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-muted-foreground font-medium">Last Scan</span>
              </div>
              {data?.last_job ? (
                <>
                  <div className="flex items-center gap-1.5">
                    {lastJobOk
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      : <XCircle      className="w-4 h-4 text-red-400 flex-shrink-0" />
                    }
                    <p className="text-sm font-semibold truncate">{data.last_job.name || `Job #${data.last_job.id}`}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {relTime(data.last_job.finished_at)} · {data.last_job.hosts_found} host{data.last_job.hosts_found !== 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No scans yet</p>
              )}
            </div>

            {/* 7-day jobs */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs text-muted-foreground font-medium">Jobs (7 days)</span>
              </div>
              <p className="text-2xl font-bold">{data?.jobs_last_7d.total ?? 0}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                <span className="text-emerald-400">{data?.jobs_last_7d.completed ?? 0} ok</span>
                {(data?.jobs_last_7d.failed ?? 0) > 0 && (
                  <span className="text-red-400">{data?.jobs_last_7d.failed} failed</span>
                )}
              </div>
            </div>
          </div>

          {/* Sparkline section */}
          <div className="px-5 py-4 border-t border-border bg-muted/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-medium text-muted-foreground">Hosts discovered — last 7 days</span>
              </div>
              <span className="text-xs font-semibold text-indigo-400">{totalFound7d} total</span>
            </div>

            <div className="flex items-end gap-3">
              {/* Chart */}
              <div className="flex-1 h-12">
                <Sparkline data={sparkValues} color="#6366f1" />
              </div>
              {/* Day labels */}
              <div className="flex gap-1 text-[10px] text-muted-foreground">
                {(data?.daily_assets_found ?? []).map((d, i) => {
                  const label = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
                  const isToday = i === 6;
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-0.5 w-7">
                      <span className={`font-semibold text-[11px] ${d.hosts_found > 0 ? 'text-indigo-400' : 'text-muted-foreground'}`}>
                        {d.hosts_found > 0 ? d.hosts_found : '·'}
                      </span>
                      <span className={isToday ? 'text-indigo-400 font-medium' : ''}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Health status bar */}
            {data?.last_job && (
              <div className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                data.last_job.status === 'completed'
                  ? 'bg-emerald-400/5 text-emerald-400 border border-emerald-400/20'
                  : data.last_job.status === 'failed'
                  ? 'bg-red-400/5 text-red-400 border border-red-400/20'
                  : 'bg-amber-400/5 text-amber-400 border border-amber-400/20'
              }`}>
                {data.last_job.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {data.last_job.status === 'failed'    && <AlertTriangle className="w-3.5 h-3.5" />}
                {data.last_job.status === 'running'   && <Play          className="w-3.5 h-3.5 animate-pulse" />}
                <span>
                  {data.last_job.status === 'completed' && `Last scan completed ${relTime(data.last_job.finished_at)} — ${data.last_job.hosts_found} host${data.last_job.hosts_found !== 1 ? 's' : ''} found`}
                  {data.last_job.status === 'failed'    && `Last scan failed ${relTime(data.last_job.finished_at)} — check Discovery for details`}
                  {data.last_job.status === 'running'   && 'A scan is currently in progress…'}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then(r => r.data),
  });

  const { data: recent, isLoading: recentLoading } = useQuery<any[]>({
    queryKey: ['recent-access'],
    queryFn: () => dashboardApi.recentAccess().then(r => r.data),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform overview and activity</p>
        </div>

        {/* Platform stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
            ))
          ) : (
            <>
              <StatCard icon={Building2}    label="Total Organizations"  value={stats?.total_organizations ?? 0}  color="bg-indigo-600" />
              <StatCard icon={CheckCircle2} label="Active Organizations" value={stats?.active_organizations ?? 0} color="bg-emerald-600" />
              <StatCard icon={Users}        label="Total Users"          value={stats?.total_users ?? 0}          color="bg-violet-600" />
              <StatCard icon={Activity}     label="Active Sessions"      value={stats?.active_sessions ?? 0}      color="bg-amber-600" />
            </>
          )}
        </div>

        {/* Discovery Health */}
        <DiscoveryHealthWidget />

        {/* Recent Access */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Recent Access</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Latest login events</p>
          </div>
          <div className="divide-y divide-border">
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 h-12 animate-pulse bg-muted/20" />
              ))
            ) : recent?.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No login events yet</div>
            ) : (
              recent?.map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 text-xs font-bold">
                      {item.user_email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.user_email}</p>
                      <p className="text-xs text-muted-foreground">{item.ip_address || 'unknown IP'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
