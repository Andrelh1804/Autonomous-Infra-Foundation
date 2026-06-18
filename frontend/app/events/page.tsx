'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { eventsApi } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, XCircle, Clock, Shield,
  Bell, Search, Filter, ChevronDown, RefreshCw,
} from 'lucide-react';

const SEV_COLOR: Record<string, string> = {
  info:      'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
  critical:  'text-red-400 bg-red-400/10 border-red-400/20',
  emergency: 'text-rose-400 bg-rose-500/15 border-rose-400/30',
};
const SEV_LABELS: Record<string, string> = {
  info: 'Info', warning: 'Aviso', critical: 'Crítico', emergency: 'Emergência',
};
const STATUS_COLOR: Record<string, string> = {
  open:         'text-amber-400 bg-amber-400/10',
  acknowledged: 'text-blue-400 bg-blue-400/10',
  resolved:     'text-emerald-400 bg-emerald-400/10',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', acknowledged: 'Reconhecido', resolved: 'Resolvido',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function EventsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'events' | 'incidents'>('events');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['monitoring-events', severity, status],
    queryFn: () => eventsApi.list({ severity: severity || undefined, status: status || undefined, per_page: 100 }).then(r => r.data),
    refetchInterval: 15_000,
  });
  const { data: stats } = useQuery({
    queryKey: ['event-stats'],
    queryFn: () => eventsApi.stats().then(r => r.data),
    refetchInterval: 15_000,
  });
  const { data: incidents, isLoading: incLoading } = useQuery({
    queryKey: ['monitoring-incidents', status],
    queryFn: () => eventsApi.listIncidents({ status: status || undefined, per_page: 100 }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const ackMut    = useMutation({ mutationFn: eventsApi.acknowledge,       onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-events'] }) });
  const resMut    = useMutation({ mutationFn: eventsApi.resolve,           onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-events'] }) });
  const ackIncMut = useMutation({ mutationFn: eventsApi.acknowledgeIncident, onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-incidents'] }) });
  const resIncMut = useMutation({ mutationFn: eventsApi.resolveIncident,   onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-incidents'] }) });

  const evtItems = (events?.items ?? []).filter((e: any) =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.target_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const incItems = (incidents?.items ?? []).filter((i: any) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Eventos & Incidentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitore e responda a alertas de infraestrutura</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Abertos',         value: stats?.open ?? 0,         color: 'bg-amber-600' },
            { label: 'Críticos',        value: stats?.critical ?? 0,     color: 'bg-red-600' },
            { label: 'Reconhecidos',    value: stats?.acknowledged ?? 0, color: 'bg-blue-600' },
            { label: 'Resolvidos',      value: stats?.resolved ?? 0,     color: 'bg-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit">
          {[
            { id: 'events',    label: 'Eventos' },
            { id: 'incidents', label: 'Incidentes' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition', tab === t.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas as severidades</option>
            {Object.entries(SEV_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {tab === 'events' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted/20 border-b border-border animate-pulse" />)
            ) : evtItems.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum evento encontrado</p>
              </div>
            ) : evtItems.map((e: any) => (
              <div key={e.id} className="px-5 py-3 border-b border-border last:border-0 flex items-center gap-4 hover:bg-muted/20 transition">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${SEV_COLOR[e.severity] ?? SEV_COLOR.info}`}>
                  {SEV_LABELS[e.severity] || e.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.target_name ? `${e.target_name} · ` : ''}{relTime(e.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[e.status] ?? ''}`}>
                  {STATUS_LABELS[e.status] || e.status}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {e.status === 'open' && (
                    <button onClick={() => ackMut.mutate(e.id)} className="text-xs px-2 py-1 rounded bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 transition">Reconhecer</button>
                  )}
                  {e.status !== 'resolved' && (
                    <button onClick={() => resMut.mutate(e.id)} className="text-xs px-2 py-1 rounded bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 transition">Resolver</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'incidents' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {incLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted/20 border-b border-border animate-pulse" />)
            ) : incItems.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum incidente</p>
              </div>
            ) : incItems.map((inc: any) => (
              <div key={inc.id} className="px-5 py-4 border-b border-border last:border-0 flex items-start gap-4 hover:bg-muted/20 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEV_COLOR[inc.severity] ?? SEV_COLOR.info}`}>
                      {SEV_LABELS[inc.severity] || inc.severity}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[inc.status] ?? ''}`}>
                      {STATUS_LABELS[inc.status] || inc.status}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{inc.title}</p>
                  {inc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{inc.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{relTime(inc.created_at)} · {inc.event_count} evento{inc.event_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {inc.status === 'open' && (
                    <button onClick={() => ackIncMut.mutate(inc.id)} className="text-xs px-2 py-1 rounded bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 transition">Reconhecer</button>
                  )}
                  {inc.status !== 'resolved' && (
                    <button onClick={() => resIncMut.mutate(inc.id)} className="text-xs px-2 py-1 rounded bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 transition">Resolver</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
