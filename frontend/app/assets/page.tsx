'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { Asset, AssetType, Manufacturer, Tag, AssetStats, PaginatedResponse } from '@/types';
import {
  Server, Plus, Trash2, Pencil, Search, Filter, X, Loader2,
  CheckCircle2, AlertTriangle, Circle, Cpu, Wifi, Shield, Printer as PrinterIcon,
  HardDrive, Cloud, Monitor, Database
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  server: Server, workstation: Monitor, switch: Cpu, router: Cpu,
  firewall: Shield, access_point: Wifi, printer: PrinterIcon,
  storage: HardDrive, virtual_machine: Server, cloud_resource: Cloud,
  ups: Cpu, iot_device: Wifi, application: Database, database: Database,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10',
  inactive: 'text-slate-400 bg-slate-400/10',
  maintenance: 'text-amber-400 bg-amber-400/10',
  retired: 'text-red-400 bg-red-400/10',
};

const CRITICALITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
};

function AssetFormModal({ open, onClose, asset }: { open: boolean; onClose: () => void; asset?: Asset }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    hostname: asset?.hostname ?? '',
    ip_address: asset?.ip_address ?? '',
    mac_address: asset?.mac_address ?? '',
    fqdn: asset?.fqdn ?? '',
    serial_number: asset?.serial_number ?? '',
    operating_system: asset?.operating_system ?? '',
    os_version: asset?.os_version ?? '',
    location: asset?.location ?? '',
    responsible: asset?.responsible ?? '',
    description: asset?.description ?? '',
    status: asset?.status ?? 'active',
    criticality: asset?.criticality ?? 'medium',
    asset_type_id: asset?.asset_type_id?.toString() ?? '',
    manufacturer_id: asset?.manufacturer_id?.toString() ?? '',
  });

  const { data: types } = useQuery<AssetType[]>({ queryKey: ['asset-types'], queryFn: () => assetsApi.types().then(r => r.data) });
  const { data: mfrs } = useQuery<Manufacturer[]>({ queryKey: ['manufacturers'], queryFn: () => assetsApi.manufacturers().then(r => r.data) });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => asset
      ? assetsApi.update(asset.id, data).then(r => r.data)
      : assetsApi.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['asset-stats'] });
      onClose();
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      ...form,
      asset_type_id: form.asset_type_id ? parseInt(form.asset_type_id) : undefined,
      manufacturer_id: form.manufacturer_id ? parseInt(form.manufacturer_id) : undefined,
    });
  };

  const F = ({ label, name, type = 'text', placeholder = '' }: { label: string; name: keyof typeof form; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">{asset ? 'Edit Asset' : 'Add Asset'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Hostname" name="hostname" placeholder="server-01" />
            <F label="IP Address" name="ip_address" placeholder="192.168.1.10" />
            <F label="MAC Address" name="mac_address" placeholder="00:1A:2B:3C:4D:5E" />
            <F label="FQDN" name="fqdn" placeholder="server-01.corp.local" />
            <F label="Operating System" name="operating_system" placeholder="Ubuntu 22.04" />
            <F label="OS Version" name="os_version" placeholder="22.04.3 LTS" />
            <F label="Serial Number" name="serial_number" />
            <F label="Location" name="location" placeholder="Data Center Rack A1" />
            <F label="Responsible" name="responsible" placeholder="IT Team" />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Asset Type</label>
              <select value={form.asset_type_id} onChange={e => setForm(f => ({ ...f, asset_type_id: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Select type —</option>
                {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Manufacturer</label>
              <select value={form.manufacturer_id} onChange={e => setForm(f => ({ ...f, manufacturer_id: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Select manufacturer —</option>
                {mfrs?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {['active', 'inactive', 'maintenance', 'retired'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label>
              <select value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {['critical', 'high', 'medium', 'low'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              {(error as any)?.response?.data?.detail || 'Failed to save asset'}
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {asset ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: stats } = useQuery<AssetStats>({
    queryKey: ['asset-stats'],
    queryFn: () => assetsApi.stats().then(r => r.data),
  });

  const { data: types } = useQuery<AssetType[]>({
    queryKey: ['asset-types'],
    queryFn: () => assetsApi.types().then(r => r.data),
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Asset>>({
    queryKey: ['assets', page, search, filterType, filterStatus],
    queryFn: () => assetsApi.list({
      page, per_page: 20,
      ...(search && { search }),
      ...(filterType && { asset_type_id: filterType }),
      ...(filterStatus && { status: filterStatus }),
    }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['asset-stats'] });
    },
  });

  const topTypes = stats?.by_type ? Object.entries(stats.by_type).filter(([, v]) => v.count > 0).slice(0, 6) : [];

  return (
    <Layout>
      <AssetFormModal open={showModal || !!editAsset} onClose={() => { setShowModal(false); setEditAsset(undefined); }} asset={editAsset} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Assets / CMDB</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats?.total.toLocaleString() ?? 0} assets registered
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>

        {/* Type breakdown */}
        {topTypes.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {topTypes.map(([slug, { name, count }]) => {
              const Icon = TYPE_ICONS[slug] || Server;
              return (
                <button
                  key={slug}
                  onClick={() => setFilterType(filterType === String(types?.find(t => t.slug === slug)?.id) ? '' : String(types?.find(t => t.slug === slug)?.id ?? ''))}
                  className="bg-card border border-border rounded-xl p-3 text-center hover:border-indigo-500/50 transition group"
                >
                  <Icon className="w-6 h-6 mx-auto mb-1.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground truncate">{name}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search hostname, IP, FQDN…"
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Types</option>
            {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Status</option>
            {['active', 'inactive', 'maintenance', 'retired'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {(search || filterType || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent transition text-muted-foreground">
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Assets</h2>
            <span className="text-xs text-muted-foreground">{data?.total ?? 0} results</span>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">No assets found. Add one manually or run a discovery scan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {['Type', 'Hostname / IP', 'OS', 'Manufacturer', 'Status', 'Criticality', 'Last Seen', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map(asset => {
                    const Icon = TYPE_ICONS[asset.asset_type?.slug ?? ''] || Server;
                    return (
                      <tr key={asset.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">{asset.asset_type?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{asset.hostname || asset.ip_address || '—'}</p>
                          {asset.hostname && asset.ip_address && (
                            <p className="text-xs text-muted-foreground font-mono">{asset.ip_address}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{asset.operating_system || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{asset.manufacturer?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status] || ''}`}>
                            <Circle className="w-2 h-2 fill-current" />
                            {asset.status}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-xs font-medium ${CRITICALITY_COLORS[asset.criticality] || ''}`}>
                          {asset.criticality}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {asset.last_seen ? formatDate(asset.last_seen) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditAsset(asset)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm('Delete asset?')) deleteMutation.mutate(asset.id); }}
                              className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
