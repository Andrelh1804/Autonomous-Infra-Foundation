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

const DEVICE_TYPES = ['server', 'switch', 'router', 'firewall', 'printer', 'ups', 'ap', 'storage', 'other'];

const DEVICE_TYPE_LABELS: Record<string, string> = {
  server: 'Servidor', switch: 'Switch', router: 'Roteador', firewall: 'Firewall',
  printer: 'Impressora', ups: 'Nobreak', ap: 'Access Point', storage: 'Storage', other: 'Outro',
};

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
        <h2 className="text-lg font-semibold mb-5">Adicionar Alvo de Monitoramento</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Nome *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Switch Principal" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Host / IP *</label>
              <input value={form.host} onChange={e => set('host', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="192.168.1.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Tipo de Dispositivo</label>
              <select value={form.device_type} onChange={e => set('device_type', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{DEVICE_TYPE_LABELS[t] || t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Método</label>
              <select value={form.collection_method} onChange={e => set('collection_method', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {['icmp', 'snmp', 'ssh', 'api'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          {form.collection_method === 'snmp' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Community</label>
                <input value={form.snmp_community} onChange={e => set('snmp_community', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Porta</label>
                <input type="number" value={form.snmp_port} onChange={e => set('snmp_port', +e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Fabricante</label>
              <input value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Cisco"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Intervalo (seg)</label>
              <input type="number" value={form.interval_seconds} onChange={e => set('interval_seconds', +e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancelar</button>
          <button onClick={() => { if (form.name && form.host) onSave(form); }}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">Adicionar Alvo</button>
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
            <h1 className="text-2xl font-bold">Alvos de Monitoramento</h1>
            <p className="text-muted-foreground text-sm mt-1">Acompanhe disponibilidade e métricas de todos os dispositivos</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
            <Plus className="w-4 h-4" /> Adicionar Alvo
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',        value: summary?.total ?? 0,      icon: Activity,     color: 'bg-indigo-600' },
            { label: 'Online',       value: summary?.online ?? 0,     icon: Wifi,         color: 'bg-emerald-600' },
            { label: 'Offline',      value: summary?.offline ?? 0,    icon: WifiOff,      color: 'bg-red-600' },
            { label: 'Saúde Média',  value: `${summary?.avg_health ?? 100}`, icon: CheckCircle2, color: 'bg-violet-600' },
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

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alvos…"
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos os tipos</option>
            {DEVICE_TYPES.map(t => <option key={t} value={t}>{DEVICE_TYPE_LABELS[t] || t}</option>)}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider grid grid-cols-[2fr_1fr_1fr_1fr_80px_100px] gap-4">
            <span>Alvo</span><span>Tipo / Método</span><span>Status</span><span>Saúde</span><span>Intervalo</span><span>Ações</span>
          </div>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 h-14 animate-pulse bg-muted/20 border-b border-border" />
            ))
          ) : targets.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum alvo de monitoramento ainda</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300">Adicionar primeiro alvo →</button>
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
                    <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{DEVICE_TYPE_LABELS[t.device_type] || t.device_type}</span>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase">{t.collection_method}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.is_online === true  && <><Wifi    className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Online</span></>}
                    {t.is_online === false && <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-400">Offline</span></>}
                    {t.is_online === null  && <><Clock   className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Desconhecido</span></>}
                  </div>
                  <HealthBar score={t.health_score ?? 100} />
                  <span className="text-xs text-muted-foreground">{t.interval_seconds}s</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => pollMut.mutate(t.id)} title="Sondar agora"
                      className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground">
                      <RefreshCw className={`w-3.5 h-3.5 ${pollMut.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => deleteMut.mutate(t.id)} title="Excluir"
                      className="p-1.5 rounded hover:bg-red-500/10 transition text-muted-foreground hover:text-red-400">
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
