'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Bot, Plus, Pencil, Trash2, Power, Play, Zap } from 'lucide-react';

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual', alert: 'Alerta', monitoring_event: 'Evento Mon.', ticket_created: 'Ticket Criado',
  schedule: 'Agendado', webhook: 'Webhook', incident: 'Incidente', threshold: 'Threshold',
};

function AutomationModal({ open, onClose, rule }: { open: boolean; onClose: () => void; rule?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: rule?.name ?? '', description: rule?.description ?? '',
    trigger_type: rule?.trigger_type ?? 'alert', is_enabled: rule?.is_enabled ?? true,
    conditions: rule?.conditions ?? '[]', actions: rule?.actions ?? '[]',
  });
  const mut = useMutation({
    mutationFn: (d: any) => rule ? automationsApi.update(rule.id, d) : automationsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{rule ? 'Editar Regra' : 'Nova Regra de Automação'}</h2>
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
          <div><label className="text-xs text-slate-400 mb-1 block">Condições (JSON)</label>
            <textarea value={form.conditions} onChange={e => set('conditions', e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 resize-none" placeholder='[{"field":"severity","op":"eq","value":"critical"}]' /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Ações (JSON)</label>
            <textarea value={form.actions} onChange={e => set('actions', e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 resize-none" placeholder='[{"type":"create_ticket","config":{"priority":"critical"}},{"type":"notify","config":{"channel":"email"}}]' /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['automations'], queryFn: () => automationsApi.list({}) });
  const delMut = useMutation({ mutationFn: (id: number) => automationsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }) });
  const toggleMut = useMutation({ mutationFn: (id: number) => automationsApi.toggle(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }) });
  const triggerMut = useMutation({ mutationFn: (id: number) => automationsApi.trigger(id, {}), onSuccess: () => alert('Automação disparada!') });
  const items = (data as any)?.items || [];
  const active = items.filter((i: any) => i.is_enabled).length;
  const totalRuns = items.reduce((a: number, i: any) => a + (i.run_count || 0), 0);
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Motor de Automação</h1><p className="text-slate-400 mt-1">Regras e automações operacionais inteligentes</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nova Regra
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{ label: 'Total', value: items.length, c: 'text-white' }, { label: 'Ativas', value: active, c: 'text-emerald-400' }, { label: 'Total Disparos', value: totalRuns, c: 'text-indigo-400' }].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <p className={`text-2xl font-bold ${c.c}`}>{c.value}</p>
              <p className="text-sm text-slate-400 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {isLoading ? <div className="p-8 text-center text-slate-400">Carregando...</div> :
            items.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-12 text-center">
                <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Nenhuma regra de automação configurada</p>
              </div>
            ) : items.map((rule: any) => (
              <div key={rule.id} className={`bg-slate-800/60 border rounded-xl p-5 transition-colors ${rule.is_enabled ? 'border-slate-700/50' : 'border-slate-700/30 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${rule.is_enabled ? 'bg-indigo-500/10' : 'bg-slate-700/50'}`}>
                      <Bot className={`w-5 h-5 ${rule.is_enabled ? 'text-indigo-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium">{rule.name}</p>
                      {rule.description && <p className="text-slate-400 text-xs mt-0.5 truncate">{rule.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                        </span>
                        <span className="text-xs text-slate-500">Disparos: {rule.run_count || 0}</span>
                        {rule.last_triggered_at && <span className="text-xs text-slate-500">Último: {new Date(rule.last_triggered_at).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => triggerMut.mutate(rule.id)} disabled={!rule.is_enabled} className="p-1.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-700 transition-colors disabled:opacity-40" title="Disparar"><Play className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleMut.mutate(rule.id)} className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${rule.is_enabled ? 'text-emerald-400' : 'text-slate-500'}`} title="Ativar/Desativar"><Power className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditing(rule); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(rule.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
        </div>
        <AutomationModal open={modal} onClose={() => setModal(false)} rule={editing} />
      </div>
    </Layout>
  );
}
