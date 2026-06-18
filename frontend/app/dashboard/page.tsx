'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Building2, Users, Activity, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { DashboardStats } from '@/types';

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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
            ))
          ) : (
            <>
              <StatCard icon={Building2} label="Total Organizations" value={stats?.total_organizations ?? 0} color="bg-indigo-600" />
              <StatCard icon={CheckCircle2} label="Active Organizations" value={stats?.active_organizations ?? 0} color="bg-emerald-600" />
              <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0} color="bg-violet-600" />
              <StatCard icon={Activity} label="Active Sessions" value={stats?.active_sessions ?? 0} color="bg-amber-600" />
            </>
          )}
        </div>

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
