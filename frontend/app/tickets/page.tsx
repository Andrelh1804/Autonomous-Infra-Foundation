'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Ticket, Plus, Search, AlertCircle, CheckCircle, Clock, XCircle, Flame } from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
};
const PRIORITY_LABELS: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };
const STATUS_COLORS: Record<string, string> = {
  open: 'text-blue-400 bg-blue-400/10', in_progress: 'text-indigo-400 bg-indigo-400/10',
  pending: 'text-amber-400 bg-amber-400/10', resolved: 'text-emerald-400 bg-emerald-400/10',
  closed: 'text-slate-400 bg-slate-400/10',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em Andamento', pending: 'Pendente', resolved: 'Resolvido', closed: 'Fechado',
};
const TYPE_LABELS: Record<string, string> = { incident: 'Incidente', service_request: 'Solicitação', problem: 'Problema', change: 'Mudança' };

function TicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    ticket_type: 'incident', title: '', description: '', category: '',
    priority: 'medium', impact: 'medium', urgency: 'medium', source: 'manual',
  });
  const mut = useMutation({
    mutationFn: (d: any) => ticketsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); qc.invalidateQueries({ queryKey: ['ticket-stats'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Novo Ticket</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
              <select value={form.ticket_type} onChange={e => set('ticket_type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="incident">Incidente</option><option value="service_request">Solicitação</option>
                <option value="problem">Problema</option><option value="change">Mudança</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixa</option><option value="medium">Média</option>
                <option value="high">Alta</option><option value="critical">Crítica</option>
              </select></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Título *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Descreva o problema brevemente..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Descreva detalhes, passos para reproduzir, impacto..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Impacto</label>
              <select value={form.impact} onChange={e => set('impact', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="critical">Crítico</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Urgência</label>
              <select value={form.urgency} onChange={e => set('urgency', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option>
              </select></div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.title} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">
            {mut.isPending ? 'Criando...' : 'Criar Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['ticket-stats'], queryFn: ticketsApi.getStats });
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', search, type, status, priority, page],
    queryFn: () => ticketsApi.list({ search, ticket_type: type, status, priority, page }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: any) => ticketsApi.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); qc.invalidateQueries({ queryKey: ['ticket-stats'] }); },
  });

  const items = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  const s = stats as any;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Central de Tickets</h1>
            <p className="text-slate-400 mt-1">Incidentes, solicitações e acompanhamento de SLA</p>
          </div>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Novo Ticket
          </button>
        </div>

        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: s.total, color: 'text-white' },
              { label: 'Abertos', value: s.open, color: 'text-blue-400' },
              { label: 'Resolvidos', value: s.resolved, color: 'text-emerald-400' },
              { label: 'SLA Violado', value: s.sla_breached, color: 'text-red-400' },
              { label: 'Críticos', value: s.by_priority?.critical, color: 'text-red-400' },
              { label: 'Incidentes', value: s.by_type?.incident, color: 'text-orange-400' },
              { label: 'Solicitações', value: s.by_type?.service_request, color: 'text-indigo-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <p className={`text-xl font-bold ${c.color}`}>{c.value ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número ou título..." className="flex-1 min-w-48 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
            <select value={type} onChange={e => setType(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos tipos</option>
              <option value="incident">Incidente</option><option value="service_request">Solicitação</option>
              <option value="problem">Problema</option><option value="change">Mudança</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option>
              <option value="open">Aberto</option><option value="in_progress">Em Andamento</option>
              <option value="pending">Pendente</option><option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas prioridades</option>
              <option value="critical">Crítica</option><option value="high">Alta</option>
              <option value="medium">Média</option><option value="low">Baixa</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Número</th>
                <th className="text-left p-4">Título</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-left p-4">Prioridade</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">SLA</th>
                <th className="text-left p-4">Criado</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum ticket encontrado</td></tr> :
                    items.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="p-4"><span className="text-indigo-400 font-mono text-xs">{t.number}</span></td>
                        <td className="p-4 max-w-xs">
                          <p className="text-white font-medium truncate">{t.title}</p>
                          {t.category && <p className="text-xs text-slate-400 mt-0.5">{t.category}</p>}
                        </td>
                        <td className="p-4 text-slate-300 text-xs">{TYPE_LABELS[t.ticket_type] || t.ticket_type}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded border text-xs ${PRIORITY_COLORS[t.priority] || ''}`}>
                            {PRIORITY_LABELS[t.priority] || t.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[t.status] || ''}`}>
                            {STATUS_LABELS[t.status] || t.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {t.sla_breached ? (
                            <span className="text-xs text-red-400 flex items-center gap-1"><Flame className="w-3 h-3" /> Violado</span>
                          ) : t.resolution_due_at ? (
                            <span className="text-xs text-emerald-400">OK</span>
                          ) : <span className="text-xs text-slate-500">–</span>}
                        </td>
                        <td className="p-4 text-slate-400 text-xs">{t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '–'}</td>
                        <td className="p-4">
                          <select value={t.status} onChange={e => updateMut.mutate({ id: t.id, status: e.target.value })} onClick={e => e.stopPropagation()} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none">
                            <option value="open">Aberto</option><option value="in_progress">Em Andamento</option>
                            <option value="pending">Pendente</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-slate-400 border-t border-slate-700/50">{total} tickets encontrados</div>
        </div>
        <TicketModal open={modal} onClose={() => setModal(false)} />
      </div>
    </Layout>
  );
}
