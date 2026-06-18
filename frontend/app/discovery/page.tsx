'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryApi, schedulesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { DiscoveryJob, DiscoverySchedule, DiscoveryStats, PaginatedResponse } from '@/types';
import {
  Radar, Play, Trash2, CheckCircle2, XCircle, Clock, Loader2,
  Plus, AlertTriangle, Calendar, ToggleLeft, ToggleRight,
  RefreshCw, Pencil, ChevronRight,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10',
  running:   'text-blue-400 bg-blue-400/10',
  pending:   'text-amber-400 bg-amber-400/10',
  failed:    'text-red-400 bg-red-400/10',
};
const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running:   Loader2,
  pending:   Clock,
  failed:    XCircle,
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído', running: 'Em andamento', pending: 'Pendente', failed: 'Falhou',
};

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'text-slate-400 bg-slate-400/10'}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function intervalLabel(minutes: number) {
  if (minutes < 60) return `A cada ${minutes}min`;
  if (minutes === 60) return 'A cada hora';
  if (minutes < 1440) return `A cada ${minutes / 60}h`;
  if (minutes === 1440) return 'Diário';
  if (minutes === 10080) return 'Semanal';
  return `A cada ${minutes}min`;
}

const INTERVAL_PRESETS = [
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora',     value: 60 },
  { label: '3 horas',    value: 180 },
  { label: '6 horas',    value: 360 },
  { label: '12 horas',   value: 720 },
  { label: '24 horas',   value: 1440 },
  { label: '1 semana',   value: 10080 },
];

function NewDiscoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [targets, setTargets] = useState('');
  const [name, setName] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => discoveryApi.start(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
      onClose(); setTargets(''); setName('');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Radar className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold">Nova Varredura</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          const tl = targets.split('\n').map(t => t.trim()).filter(Boolean);
          if (!tl.length) return;
          mutate({ name: name || undefined, targets: tl, methods: ['icmp', 'dns'] });
        }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Varredura da Rede do Escritório"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Alvos <span className="text-red-400">*</span></label>
            <textarea value={targets} onChange={e => setTargets(e.target.value)} rows={5} required
              placeholder={"192.168.1.0/24\n10.0.0.0/24\n172.16.0.1 - 172.16.0.50"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <p className="mt-1 text-xs text-muted-foreground">Um por linha · CIDR, intervalo de IP ou IP único</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              {(error as any)?.response?.data?.detail || 'Falha ao iniciar'}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancelar</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isPending ? 'Iniciando…' : 'Iniciar Discovery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleModal({ open, onClose, schedule }: { open: boolean; onClose: () => void; schedule?: DiscoverySchedule }) {
  const qc = useQueryClient();
  const [name, setName]       = useState(schedule?.name ?? '');
  const [targets, setTargets] = useState(schedule ? (JSON.parse(schedule.targets) as string[]).join('\n') : '');
  const [interval, setInterval] = useState(schedule?.interval_minutes ?? 60);
  const [custom, setCustom]   = useState(!INTERVAL_PRESETS.some(p => p.value === (schedule?.interval_minutes ?? 60)));
  const [customV, setCustomV] = useState(String(schedule?.interval_minutes ?? 60));

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => schedule
      ? schedulesApi.update(schedule.id, data).then(r => r.data)
      : schedulesApi.create(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); onClose(); },
  });

  if (!open) return null;

  const effectiveInterval = custom ? (parseInt(customV) || 60) : interval;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tl = targets.split('\n').map(t => t.trim()).filter(Boolean);
    if (!tl.length) return;
    mutate({ name, targets: tl, interval_minutes: effectiveInterval, methods: ['icmp', 'dns'] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold">{schedule ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome do Agendamento <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Varredura Horária do Escritório"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Alvos <span className="text-red-400">*</span></label>
            <textarea value={targets} onChange={e => setTargets(e.target.value)} rows={4} required
              placeholder={"192.168.1.0/24\n10.0.0.1 - 10.0.0.254"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <p className="mt-1 text-xs text-muted-foreground">Um por linha · CIDR, intervalo ou IP único</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Intervalo de Repetição</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {INTERVAL_PRESETS.map(p => (
                <button type="button" key={p.value}
                  onClick={() => { setInterval(p.value); setCustom(false); }}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition ${!custom && interval === p.value ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border hover:bg-accent'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setCustom(c => !c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${custom ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border text-muted-foreground hover:bg-accent'}`}>
              Intervalo personalizado
            </button>
            {custom && (
              <div className="flex items-center gap-2 mt-2">
                <input type="number" value={customV} onChange={e => setCustomV(e.target.value)} min={1} max={525600}
                  className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              {(error as any)?.response?.data?.detail || 'Falha ao salvar'}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancelar</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {schedule ? 'Salvar Alterações' : 'Criar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SchedulesTab() {
  const qc = useQueryClient();
  const [showModal,    setShowModal]    = useState(false);
  const [editSchedule, setEditSchedule] = useState<DiscoverySchedule | undefined>();

  const { data: schedules = [], isLoading } = useQuery<DiscoverySchedule[]>({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.list().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: status } = useQuery<{ running: boolean; jobs: number }>({
    queryKey: ['scheduler-status'],
    queryFn: () => schedulesApi.status().then(r => r.data),
    refetchInterval: 15000,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.runNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => schedulesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  return (
    <>
      <ScheduleModal open={showModal || !!editSchedule} onClose={() => { setShowModal(false); setEditSchedule(undefined); }} schedule={editSchedule} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm text-muted-foreground">
              Motor de agendamento {status?.running ? `em execução · ${status.jobs} job${status.jobs !== 1 ? 's' : ''} ativo${status.jobs !== 1 ? 's' : ''}` : 'parado'}
            </span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : schedules.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">Nenhum agendamento ainda</p>
            <p className="text-muted-foreground text-sm">Crie um agendamento recorrente para executar varreduras automaticamente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(s => {
              const targetList: string[] = JSON.parse(s.targets);
              return (
                <div key={s.id} className={`bg-card border rounded-xl p-5 transition-all ${s.is_enabled ? 'border-border' : 'border-border opacity-60'}`}>
                  <div className="flex items-start gap-4">
                    <button onClick={() => toggleMutation.mutate(s.id)} disabled={toggleMutation.isPending}
                      className={`mt-0.5 transition-colors flex-shrink-0 ${s.is_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'}`}>
                      {s.is_enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{s.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_enabled ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}>
                          {s.is_enabled ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {targetList.slice(0, 3).map(t => (
                          <span key={t} className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{t}</span>
                        ))}
                        {targetList.length > 3 && <span className="text-xs text-muted-foreground">+{targetList.length - 3} mais</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {intervalLabel(s.interval_minutes)}
                        </span>
                        {s.last_run_at && <span>Última execução: {formatDate(s.last_run_at)}</span>}
                        {s.is_enabled && s.next_run_at && (
                          <span className="text-indigo-400">Próxima: {formatDate(s.next_run_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => runNowMutation.mutate(s.id)} disabled={runNowMutation.isPending}
                        title="Executar agora"
                        className="p-2 rounded-lg hover:bg-indigo-400/10 text-muted-foreground hover:text-indigo-400 transition">
                        {runNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditSchedule(s)} title="Editar"
                        className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Excluir este agendamento?')) deleteMutation.mutate(s.id); }}
                        className="p-2 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function JobsTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<DiscoveryStats>({
    queryKey: ['discovery-stats'],
    queryFn: () => discoveryApi.stats().then(r => r.data),
    refetchInterval: 5000,
  });

  const { data, isLoading } = useQuery<PaginatedResponse<DiscoveryJob>>({
    queryKey: ['discovery-jobs', page],
    queryFn: () => discoveryApi.list({ page, per_page: 20 }).then(r => r.data),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => discoveryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-jobs'] });
      qc.invalidateQueries({ queryKey: ['discovery-stats'] });
    },
  });

  return (
    <>
      <NewDiscoveryModal open={showModal} onClose={() => setShowModal(false)} />
      <div className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total',        value: stats?.total_jobs ?? 0,       color: 'text-slate-300' },
            { label: 'Concluídos',   value: stats?.completed ?? 0,        color: 'text-emerald-400' },
            { label: 'Em andamento', value: stats?.running ?? 0,          color: 'text-blue-400' },
            { label: 'Pendentes',    value: stats?.pending ?? 0,          color: 'text-amber-400' },
            { label: 'Falhos',       value: stats?.failed ?? 0,           color: 'text-red-400' },
            { label: 'Hosts Encontrados', value: stats?.total_hosts_found ?? 0, color: 'text-indigo-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value.toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Jobs de Discovery</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{data?.total ?? 0} total</span>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition">
                <Plus className="w-3.5 h-3.5" />Nova Varredura
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">Nenhum job ainda — inicie sua primeira varredura ou crie um agendamento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {['Nome', 'Alvos', 'Status', 'Encontrados', 'Iniciado em', 'Duração', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map(job => {
                    const targets = job.targets ? JSON.parse(job.targets) : [];
                    const duration = job.started_at && job.finished_at
                      ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                      : null;
                    const isScheduled = job.name?.startsWith('[Scheduled]') || job.name?.startsWith('[Manual]');
                    return (
                      <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {isScheduled && <Calendar className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                            <div>
                              <p className="font-medium">{job.name || `Job #${job.id}`}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {targets.slice(0, 2).map((t: string) => (
                              <span key={t} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{t}</span>
                            ))}
                            {targets.length > 2 && <span className="text-xs text-muted-foreground">+{targets.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-emerald-400">{job.hosts_found}</span>
                          {job.hosts_scanned > 0 && <span className="text-muted-foreground text-xs"> / {job.hosts_scanned}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{job.started_at ? formatDate(job.started_at) : '—'}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {duration !== null ? `${duration}s` : job.status === 'running' ? <span className="text-blue-400">em andamento…</span> : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => { if (confirm('Excluir?')) deleteMutation.mutate(job.id); }} disabled={job.status === 'running'}
                            className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition disabled:opacity-30">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
              <p className="text-xs text-muted-foreground">Página {page} de {data.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pages} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Próxima</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DiscoveryPage() {
  const [tab, setTab] = useState<'jobs' | 'schedules'>('jobs');

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Centro de Discovery</h1>
          <p className="text-muted-foreground text-sm mt-1">Descubra, inventarie e agende varreduras de ativos de rede</p>
        </div>
        <div className="flex border-b border-border">
          {([
            { id: 'jobs',      label: 'Jobs',         icon: Radar },
            { id: 'schedules', label: 'Agendamentos', icon: Calendar },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        {tab === 'jobs'      && <JobsTab />}
        {tab === 'schedules' && <SchedulesTab />}
      </div>
    </Layout>
  );
}
