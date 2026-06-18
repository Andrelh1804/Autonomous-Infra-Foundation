'use client';
import { useQuery } from '@tanstack/react-query';
import { assetsApi } from '@/services/api';
import Layout from '@/components/Layout';
import type { Asset, AssetStats } from '@/types';
import { Server, Shield, Cpu, Wifi, HardDrive, Monitor, Cloud, Database, Network } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  server: Server, workstation: Monitor, switch: Cpu, router: Cpu,
  firewall: Shield, access_point: Wifi, storage: HardDrive,
  virtual_machine: Server, cloud_resource: Cloud, database: Database,
};

const TYPE_COLORS: Record<string, string> = {
  server: 'border-indigo-500 bg-indigo-500/10 text-indigo-400',
  workstation: 'border-blue-500 bg-blue-500/10 text-blue-400',
  switch: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
  router: 'border-teal-500 bg-teal-500/10 text-teal-400',
  firewall: 'border-red-500 bg-red-500/10 text-red-400',
  access_point: 'border-violet-500 bg-violet-500/10 text-violet-400',
  storage: 'border-amber-500 bg-amber-500/10 text-amber-400',
  virtual_machine: 'border-purple-500 bg-purple-500/10 text-purple-400',
  cloud_resource: 'border-sky-500 bg-sky-500/10 text-sky-400',
  printer: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
};

function AssetNode({ asset }: { asset: Asset }) {
  const slug = asset.asset_type?.slug ?? 'server';
  const Icon = TYPE_ICONS[slug] || Server;
  const color = TYPE_COLORS[slug] || 'border-slate-500 bg-slate-500/10 text-slate-400';
  const isActive = asset.status === 'active';

  return (
    <div className={`relative border rounded-xl p-3 w-44 cursor-default transition-all hover:scale-105 hover:shadow-lg ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs font-semibold truncate">{asset.asset_type?.name ?? 'Asset'}</span>
        <div className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      </div>
      <p className="text-sm font-medium truncate" title={asset.hostname ?? asset.ip_address ?? ''}>
        {asset.hostname || asset.ip_address || '—'}
      </p>
      {asset.ip_address && asset.hostname && (
        <p className="text-xs opacity-60 font-mono truncate">{asset.ip_address}</p>
      )}
      {asset.manufacturer && (
        <p className="text-xs opacity-50 mt-0.5 truncate">{asset.manufacturer.name}</p>
      )}
    </div>
  );
}

export default function NetworkMapPage() {
  const { data: assetsData, isLoading } = useQuery<{ items: Asset[]; total: number }>({
    queryKey: ['assets-map'],
    queryFn: () => assetsApi.list({ per_page: 200 }).then(r => r.data),
  });

  const { data: stats } = useQuery<AssetStats>({
    queryKey: ['asset-stats'],
    queryFn: () => assetsApi.stats().then(r => r.data),
  });

  const assets = assetsData?.items ?? [];

  const grouped = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    const key = a.asset_type?.slug ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const groupOrder = ['firewall', 'router', 'switch', 'access_point', 'server', 'virtual_machine', 'workstation', 'storage', 'cloud_resource', 'printer', 'database', 'unknown'];
  const sortedGroups = groupOrder.filter(g => grouped[g]?.length > 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Network Map</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual overview of {assetsData?.total ?? 0} assets across your infrastructure
          </p>
        </div>

        {/* Summary stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.by_status['active'] ?? 0}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{stats.by_status['maintenance'] ?? 0}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold mt-1 text-slate-400">{stats.by_status['inactive'] ?? 0}</p>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <Network className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold">Infrastructure Map</h2>
            <span className="ml-auto text-xs text-muted-foreground">{sortedGroups.length} groups</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm mt-3">Loading map…</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center">
              <Network className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No assets found. Run a discovery scan to populate your map.</p>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {sortedGroups.map(typeSlug => {
                const group = grouped[typeSlug];
                const Icon = TYPE_ICONS[typeSlug] || Server;
                const color = TYPE_COLORS[typeSlug] || '';
                const typeName = group[0]?.asset_type?.name ?? typeSlug.replace('_', ' ');
                return (
                  <div key={typeSlug}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-sm">{typeName}</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.length}</span>
                      <div className="flex-1 border-t border-dashed border-border ml-2" />
                    </div>
                    <div className="flex flex-wrap gap-3 pl-2">
                      {group.map(asset => <AssetNode key={asset.id} asset={asset} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium mb-3">Legend</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Active
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Inactive / Unknown
            </div>
            {Object.entries(TYPE_COLORS).slice(0, 6).map(([slug, color]) => {
              const Icon = TYPE_ICONS[slug] || Server;
              return (
                <div key={slug} className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border ${color}`}>
                  <Icon className="w-3 h-3" />
                  {slug.replace('_', ' ')}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
