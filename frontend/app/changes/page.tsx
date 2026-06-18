'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { GitMerge, Plus, Pencil, Trash2, CheckCircle, XCircle, Calendar } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-slate-400 bg-slate-400/10', review: 'text-blue-400 bg-blue-400/10',
  approved: 'text-emerald-400 bg-emerald-400/10', scheduled: 'text-indigo-400 bg-indigo-400/10',
  implementing: 'text-amber-400 bg-amber-400/10', completed: 'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-slate-400 bg-slate-400/10', failed: 'text-red-400 bg-red-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};
const TYPE_COLORS: Record<string, string> = {
  standard: 'bg-blue-500/10 text-blue-400', normal: 'bg-indigo-500/10 text-indigo-400',
  emergency: 'bg-red-500/10 text-red-400',
};
const RISK_COLORS: Record<string, string> = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-emerald-400' };

function ChangeModal({ open, onClose, change }: { open: boolean; onClose: () => void; change?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    change_type: change?.change_type ?? 'normal', title: change?.title ?? '',
    description: change?.description ?? '', category: change?.category ?? '',
    priority: change?.priority ?? 'medium', risk: change?.risk ?? 'medium',
    impact: change?.impact ?? 'medium', justification: change?.justification ?? '',
    implementation_plan: change?.implementation_plan ?? '', rollback_plan: change?.rollback_plan ?? '',
    test_plan: change?.test_plan ?? '',
    scheduled_start: change?.scheduled_start ? change.scheduled_start.substring(0, 16) : '',
    scheduled_end: change?.scheduled_end ? change.scheduled_end.substring(0, 16) : '',
  });
  const mut = useMutation({
    mutationFn: (d: any) => change ? changesApi.update(change.id, d) : changesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['changes'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{change ? 'Editar Mudança' : 'Nova Mudança'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
              <select value={form.change_type} onChange={e => set('change_type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="standard">Padrão</option><option value="normal">Normal</option><option value="emergency">Emergencial</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Risco</label>
              <select value={form.risk} onChange={e => set('risk', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Impacto</label>
              <select value={form.impact} onChange={e => set('impact', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="critical">Crítico</option>
              </select></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Título *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Justificativa</label>
            <textarea value={form.justification} onChange={e => set('justification', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Plano de Implementação</label>
            <textarea value={form.implementation_plan} onChange={e => set('implementation_plan', e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Plano de Rollback</label>
            <textarea value={form.rollback_plan} onChange={e => set('rollback_plan', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Início Programado</label>
              <input type="datetime-local" value={form.scheduled_start} onChange={e => set('scheduled_start', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Fim Programado</label>
              <input type="datetime-local" value={form.scheduled_end} onChange={e => set('scheduled_end', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.title} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">
            {mut.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChangesPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [changeType, setChangeType] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['changes', status, changeType], queryFn: () => changesApi.list({ status, change_type: changeType }) });
  const { data: stats } = useQuery({ queryKey: ['change-stats'], queryFn: changesApi.getStats });
  const delMut = useMutation({ mutationFn: (id: number) => changesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['changes'] }) });
  const items = (data as any)?.items || [];
  const s = stats as any;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Gerenciamento de Mudanças</h1><p className="text-slate-400 mt-1">Controle e aprovação de mudanças na infraestrutura</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nova Mudança
          </button>
        </div>
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ l: 'Total', v: s.total, c: 'text-white' }, { l: 'Rascunho', v: s.by_status?.draft, c: 'text-slate-400' }, { l: 'Aprovadas', v: s.by_status?.approved, c: 'text-emerald-400' }, { l: 'Emergenciais', v: s.by_type?.emergency, c: 'text-red-400' }].map(i => (
              <div key={i.l} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <p className={`text-2xl font-bold ${i.c}`}>{i.v ?? 0}</p>
                <p className="text-sm text-slate-400 mt-1">{i.l}</p>
              </div>
            ))}
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex gap-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option><option value="draft">Rascunho</option>
              <option value="review">Revisão</option><option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option><option value="implementing">Implementando</option>
              <option value="completed">Concluído</option><option value="cancelled">Cancelado</option>
              <option value="failed">Falhou</option>
            </select>
            <select value={changeType} onChange={e => setChangeType(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos tipos</option><option value="standard">Padrão</option>
              <option value="normal">Normal</option><option value="emergency">Emergencial</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Número</th><th className="text-left p-4">Título</th>
                <th className="text-left p-4">Tipo</th><th className="text-left p-4">Risco</th>
                <th className="text-left p-4">Status</th><th className="text-left p-4">Agendado</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma mudança registrada</td></tr> :
                    items.map((c: any) => (
                      <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4 font-mono text-xs text-indigo-400">{c.number}</td>
                        <td className="p-4 text-white max-w-xs"><p className="truncate">{c.title}</p></td>
                        <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[c.change_type] || ''}`}>{c.change_type}</span></td>
                        <td className="p-4"><span className={`text-xs font-medium ${RISK_COLORS[c.risk]}`}>{c.risk}</span></td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span></td>
                        <td className="p-4 text-slate-400 text-xs">{c.scheduled_start ? new Date(c.scheduled_start).toLocaleString('pt-BR') : '–'}</td>
                        <td className="p-4 flex gap-1">
                          <button onClick={() => { setEditing(c); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(c.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <ChangeModal open={modal} onClose={() => setModal(false)} change={editing} />
      </div>
    </Layout>
  );
}
