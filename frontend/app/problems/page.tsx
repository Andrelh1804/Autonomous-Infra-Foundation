'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { AlertOctagon, Plus, Pencil, Trash2, Link } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  open: 'text-red-400 bg-red-400/10', investigating: 'text-amber-400 bg-amber-400/10',
  known_error: 'text-orange-400 bg-orange-400/10', resolved: 'text-emerald-400 bg-emerald-400/10', closed: 'text-slate-400 bg-slate-400/10',
};
const STATUS_LABELS: Record<string, string> = { open: 'Aberto', investigating: 'Investigando', known_error: 'Erro Conhecido', resolved: 'Resolvido', closed: 'Fechado' };
const PRIORITY_COLORS: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-blue-400' };

function ProblemModal({ open, onClose, problem }: { open: boolean; onClose: () => void; problem?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: problem?.title ?? '', description: problem?.description ?? '',
    category: problem?.category ?? '', priority: problem?.priority ?? 'medium',
    impact: problem?.impact ?? 'medium', root_cause: problem?.root_cause ?? '',
    workaround: problem?.workaround ?? '', solution: problem?.solution ?? '',
  });
  const mut = useMutation({
    mutationFn: (d: any) => problem ? problemsApi.update(problem.id, d) : problemsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['problems'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{problem ? 'Editar Problema' : 'Novo Problema'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Título *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="low">Baixa</option><option value="medium">Média</option>
                <option value="high">Alta</option><option value="critical">Crítica</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Causa Raiz</label>
            <textarea value={form.root_cause} onChange={e => set('root_cause', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Workaround</label>
            <textarea value={form.workaround} onChange={e => set('workaround', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Solução</label>
            <textarea value={form.solution} onChange={e => set('solution', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
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

export default function ProblemsPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['problems', status, priority], queryFn: () => problemsApi.list({ status, priority }) });
  const { data: stats } = useQuery({ queryKey: ['problem-stats'], queryFn: problemsApi.getStats });
  const delMut = useMutation({ mutationFn: (id: number) => problemsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['problems'] }) });
  const items = (data as any)?.items || [];
  const s = stats as any;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Gestão de Problemas</h1><p className="text-slate-400 mt-1">Análise de causa raiz e problemas recorrentes</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Novo Problema
          </button>
        </div>
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ label: 'Total', value: s.total, c: 'text-white' }, { label: 'Abertos', value: s.open, c: 'text-red-400' }, { label: 'Resolvidos', value: s.resolved, c: 'text-emerald-400' }, { label: 'Fechados', value: s.closed, c: 'text-slate-400' }].map(c => (
              <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <p className={`text-2xl font-bold ${c.c}`}>{c.value ?? 0}</p>
                <p className="text-sm text-slate-400 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex gap-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option><option value="open">Aberto</option>
              <option value="investigating">Investigando</option><option value="known_error">Erro Conhecido</option>
              <option value="resolved">Resolvido</option><option value="closed">Fechado</option>
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas prioridades</option><option value="critical">Crítica</option>
              <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Número</th><th className="text-left p-4">Título</th>
                <th className="text-left p-4">Prioridade</th><th className="text-left p-4">Status</th>
                <th className="text-left p-4">Causa Raiz</th><th className="text-left p-4">Criado</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum problema registrado</td></tr> :
                    items.map((p: any) => (
                      <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4 font-mono text-xs text-indigo-400">{p.number}</td>
                        <td className="p-4 text-white max-w-xs"><p className="truncate">{p.title}</p></td>
                        <td className="p-4"><span className={`text-xs font-medium ${PRIORITY_COLORS[p.priority]}`}>{p.priority}</span></td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[p.status] || ''}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
                        <td className="p-4 text-slate-300 text-xs max-w-xs"><p className="truncate">{p.root_cause || '–'}</p></td>
                        <td className="p-4 text-slate-400 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '–'}</td>
                        <td className="p-4 flex gap-1">
                          <button onClick={() => { setEditing(p); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(p.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <ProblemModal open={modal} onClose={() => setModal(false)} problem={editing} />
      </div>
    </Layout>
  );
}
