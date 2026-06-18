'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Workflow, Plus, Play, Pencil, Trash2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual', ticket_created: 'Ticket Criado', alert: 'Alerta', schedule: 'Agendado',
  monitoring_event: 'Evento Mon.', incident: 'Incidente', webhook: 'Webhook',
};
const STATUS_COLORS: Record<string, string> = { running: 'text-blue-400', completed: 'text-emerald-400', failed: 'text-red-400', pending: 'text-amber-400' };

function WorkflowModal({ open, onClose, workflow }: { open: boolean; onClose: () => void; workflow?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: workflow?.name ?? '', description: workflow?.description ?? '',
    trigger_type: workflow?.trigger_type ?? 'manual', is_enabled: workflow?.is_enabled ?? true,
    steps: workflow?.steps ?? '[]',
  });
  const mut = useMutation({
    mutationFn: (d: any) => workflow ? workflowsApi.update(workflow.id, d) : workflowsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{workflow ? 'Editar Workflow' : 'Novo Workflow'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Gatilho</label>
            <select value={form.trigger_type} onChange={e => set('trigger_type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Passos (JSON)</label>
            <textarea value={form.steps} onChange={e => set('steps', e.target.value)} rows={4} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 resize-none" placeholder='[{"type":"create_ticket","config":{}},{"type":"notify","config":{}}]' /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: () => workflowsApi.list({}) });
  const delMut = useMutation({ mutationFn: (id: number) => workflowsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }) });
  const execMut = useMutation({ mutationFn: (id: number) => workflowsApi.execute(id, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); alert('Workflow executado!'); } });
  const items = (data as any)?.items || [];
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Workflow Engine</h1><p className="text-slate-400 mt-1">Automação de processos e fluxos de trabalho</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Novo Workflow
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total', value: items.length, color: 'text-white' },
            { label: 'Ativos', value: items.filter((i: any) => i.is_enabled).length, color: 'text-emerald-400' },
            { label: 'Execuções Totais', value: items.reduce((a: number, i: any) => a + (i.run_count || 0), 0), color: 'text-indigo-400' },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-sm text-slate-400 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? <div className="p-8 text-center text-slate-400 col-span-2">Carregando...</div> :
            items.length === 0 ? (
              <div className="col-span-2 bg-slate-800/60 border border-slate-700/50 rounded-xl p-12 text-center">
                <Workflow className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Nenhum workflow configurado</p>
              </div>
            ) : items.map((wf: any) => (
              <div key={wf.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-indigo-500/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wf.is_enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <h3 className="text-white font-medium">{wf.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { if (confirm('Executar manualmente?')) execMut.mutate(wf.id); }} className="p-1.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-700" title="Executar">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditing(wf); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(wf.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {wf.description && <p className="text-slate-400 text-xs mb-3">{wf.description}</p>}
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                    <Zap className="w-3 h-3" /> {TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type}
                  </span>
                  <span className="text-slate-500">Execuções: {wf.run_count || 0}</span>
                  {wf.last_run_at && <span className="text-slate-500">Última: {new Date(wf.last_run_at).toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
            ))}
        </div>
        <WorkflowModal open={modal} onClose={() => setModal(false)} workflow={editing} />
      </div>
    </Layout>
  );
}
