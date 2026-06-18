'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, agentsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Cpu, Plus, XCircle, CheckCircle, Clock, PlayCircle, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10', failed: 'text-red-400 bg-red-400/10',
  pending: 'text-amber-400 bg-amber-400/10', running: 'text-blue-400 bg-blue-400/10',
  cancelled: 'text-slate-400 bg-slate-400/10',
};

function NewJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ endpoint_id: '', job_type: 'script', name: '', description: '', parameters: '' });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });
  const mut = useMutation({
    mutationFn: (d: any) => jobsApi.create({ ...d, endpoint_id: parseInt(d.endpoint_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); onClose(); },
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Novo Job</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Endpoint</label>
            <select value={form.endpoint_id} onChange={e => setForm(f => ({ ...f, endpoint_id: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Selecione um endpoint</option>
              {(agents as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.hostname}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
            <select value={form.job_type} onChange={e => setForm(f => ({ ...f, job_type: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="script">Script</option><option value="patch">Patch</option>
              <option value="software_install">Instalar Software</option><option value="software_uninstall">Desinstalar Software</option>
              <option value="reboot">Reiniciar</option><option value="shutdown">Desligar</option>
              <option value="disk_cleanup">Limpeza de Disco</option><option value="inventory">Inventário</option>
            </select></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.endpoint_id || !form.name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
            {mut.isPending ? 'Criando...' : 'Criar Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [modal, setModal] = useState(false);
  const [status, setStatus] = useState('');
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', status],
    queryFn: () => jobsApi.list({ status }),
    refetchInterval: 10000,
  });
  const cancelMut = useMutation({ mutationFn: (id: number) => jobsApi.cancel(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
  const items = (data as any)?.items || [];
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Jobs</h1><p className="text-slate-400 mt-1">Tarefas agendadas e em execução nos endpoints</p></div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"><Plus className="w-4 h-4" /> Novo Job</button>
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex gap-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option><option value="pending">Pendente</option>
              <option value="running">Executando</option><option value="completed">Concluído</option>
              <option value="failed">Falhou</option><option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Nome / Tipo</th>
                <th className="text-left p-4">Endpoint</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Progresso</th>
                <th className="text-left p-4">Criado</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum job encontrado</td></tr> :
                    items.map((j: any) => (
                      <tr key={j.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4">
                          <p className="text-white font-medium">{j.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{j.job_type}</p>
                        </td>
                        <td className="p-4 text-slate-300">#{j.endpoint_id}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[j.status]}`}>{j.status}</span></td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${j.progress || 0}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{j.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-400 text-xs">{j.created_at ? new Date(j.created_at).toLocaleString('pt-BR') : '–'}</td>
                        <td className="p-4">
                          {['pending', 'running'].includes(j.status) && (
                            <button onClick={() => cancelMut.mutate(j.id)} className="text-xs px-2 py-1 bg-slate-600/50 hover:bg-red-600/20 text-slate-300 hover:text-red-400 rounded transition-colors">Cancelar</button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <NewJobModal open={modal} onClose={() => setModal(false)} />
      </div>
    </Layout>
  );
}
