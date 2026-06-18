'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { remoteActionsApi, agentsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Terminal, Play, X, RefreshCw, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_ICONS: Record<string, React.ElementType> = { completed: CheckCircle, failed: XCircle, pending: Clock, running: RefreshCw, cancelled: X };
const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400', failed: 'text-red-400', pending: 'text-amber-400',
  running: 'text-blue-400', cancelled: 'text-slate-400',
};

function NewActionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ endpoint_id: '', command: '', shell: 'auto', timeout_seconds: 60, action_type: 'command' });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });
  const mut = useMutation({
    mutationFn: (d: any) => remoteActionsApi.create({ ...d, endpoint_id: parseInt(d.endpoint_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['remote-actions'] }); onClose(); },
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nova Ação Remota</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Endpoint</label>
            <select value={form.endpoint_id} onChange={e => setForm(f => ({ ...f, endpoint_id: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Selecione um endpoint</option>
              {(agents as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.hostname} ({a.ip_address})</option>)}
            </select></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Shell</label>
            <select value={form.shell} onChange={e => setForm(f => ({ ...f, shell: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="auto">Auto (detectar OS)</option><option value="powershell">PowerShell</option>
              <option value="cmd">CMD</option><option value="bash">Bash</option><option value="sh">Sh</option>
            </select></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Comando</label>
            <textarea value={form.command} onChange={e => setForm(f => ({ ...f, command: e.target.value }))} rows={4} placeholder="Ex: Get-Process | Sort-Object CPU -Descending | Select-Object -First 10" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Timeout (segundos)</label>
            <input type="number" value={form.timeout_seconds} onChange={e => setForm(f => ({ ...f, timeout_seconds: parseInt(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.endpoint_id || !form.command} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> Executar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemoteActionsPage() {
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [status, setStatus] = useState('');
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['remote-actions', status],
    queryFn: () => remoteActionsApi.list({ status }),
    refetchInterval: 5000,
  });
  const cancelMut = useMutation({
    mutationFn: (id: number) => remoteActionsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['remote-actions'] }),
  });
  const items = (data as any)?.items || [];
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Ações Remotas</h1><p className="text-slate-400 mt-1">Execute comandos remotamente nos endpoints</p></div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"><Plus className="w-4 h-4" /> Nova Ação</button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/50 rounded-xl">
            <div className="p-4 border-b border-slate-700/50 flex gap-3">
              <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Todos status</option><option value="pending">Pendente</option>
                <option value="running">Executando</option><option value="completed">Concluído</option>
                <option value="failed">Falhou</option><option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="divide-y divide-slate-700/30">
              {isLoading ? <div className="p-8 text-center text-slate-400">Carregando...</div> :
                items.length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma ação encontrada</div> :
                  items.map((a: any) => {
                    const SIcon = STATUS_ICONS[a.status] || Clock;
                    return (
                      <div key={a.id} onClick={() => setSelected(a)} className={`p-4 cursor-pointer hover:bg-slate-700/20 transition-colors ${selected?.id === a.id ? 'bg-slate-700/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <SIcon className={`w-4 h-4 flex-shrink-0 ${STATUS_COLORS[a.status]}`} />
                            <div className="min-w-0">
                              <p className="text-white font-mono text-sm truncate">{a.command}</p>
                              <p className="text-slate-400 text-xs mt-0.5">Endpoint #{a.endpoint_id} · {a.action_type} · {a.shell}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {a.status === 'pending' && <button onClick={e => { e.stopPropagation(); cancelMut.mutate(a.id); }} className="text-xs px-2 py-1 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded transition-colors">Cancelar</button>}
                            <span className="text-xs text-slate-500">{a.queued_at ? new Date(a.queued_at).toLocaleString('pt-BR') : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            {selected ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Detalhes da Ação #{selected.id}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div><p className="text-xs text-slate-400 mb-1">Comando</p><p className="font-mono text-white bg-slate-900/50 rounded p-2 text-xs break-all">{selected.command}</p></div>
                  {selected.output && <div><p className="text-xs text-slate-400 mb-1">Saída</p><pre className="font-mono text-emerald-400 bg-slate-900/50 rounded p-2 text-xs overflow-auto max-h-48">{selected.output}</pre></div>}
                  {selected.error_message && <div><p className="text-xs text-slate-400 mb-1">Erro</p><pre className="font-mono text-red-400 bg-slate-900/50 rounded p-2 text-xs overflow-auto max-h-32">{selected.error_message}</pre></div>}
                  {selected.exit_code !== null && <div><p className="text-xs text-slate-400 mb-1">Exit Code</p><p className={`text-sm font-mono ${selected.exit_code === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selected.exit_code}</p></div>}
                  {selected.completed_at && <div><p className="text-xs text-slate-400 mb-1">Concluído</p><p className="text-xs text-slate-300">{new Date(selected.completed_at).toLocaleString('pt-BR')}</p></div>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Terminal className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">Selecione uma ação para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
        <NewActionModal open={modal} onClose={() => setModal(false)} />
      </div>
    </Layout>
  );
}
