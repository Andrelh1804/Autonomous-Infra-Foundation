'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slaApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Clock, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABELS: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLORS: Record<string, string> = { critical: 'text-red-400 bg-red-400/10', high: 'text-orange-400 bg-orange-400/10', medium: 'text-amber-400 bg-amber-400/10', low: 'text-blue-400 bg-blue-400/10' };

function SlaModal({ open, onClose, policy }: { open: boolean; onClose: () => void; policy?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: policy?.name ?? '', description: policy?.description ?? '',
    priority: policy?.priority ?? 'medium', response_hours: policy?.response_hours ?? 4,
    resolution_hours: policy?.resolution_hours ?? 24, business_hours_only: policy?.business_hours_only ?? true,
    is_default: policy?.is_default ?? false, is_enabled: policy?.is_enabled ?? true,
  });
  const mut = useMutation({
    mutationFn: (d: any) => policy ? slaApi.updatePolicy(policy.id, d) : slaApi.createPolicy(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sla-policies'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{policy ? 'Editar SLA' : 'Nova Política de SLA'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Prioridade</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Tempo de Resposta (h)</label>
              <input type="number" step="0.5" value={form.response_hours} onChange={e => set('response_hours', parseFloat(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Tempo de Resolução (h)</label>
              <input type="number" step="0.5" value={form.resolution_hours} onChange={e => set('resolution_hours', parseFloat(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.business_hours_only} onChange={e => set('business_hours_only', e.target.checked)} className="w-4 h-4" />
              Apenas horário comercial
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} className="w-4 h-4" />
              Política padrão para esta prioridade
            </label>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.name} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function SlaPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: policies = [], isLoading } = useQuery({ queryKey: ['sla-policies'], queryFn: slaApi.listPolicies });
  const { data: dashboard } = useQuery({ queryKey: ['sla-dashboard'], queryFn: slaApi.getDashboard, refetchInterval: 30000 });
  const delMut = useMutation({ mutationFn: (id: number) => slaApi.deletePolicy(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['sla-policies'] }) });
  const d = dashboard as any;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Gestão de SLA</h1><p className="text-slate-400 mt-1">Políticas de nível de serviço e indicadores</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nova Política
          </button>
        </div>
        {d && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Tickets Abertos', value: d.total_open, icon: Clock, color: 'text-white' },
              { label: 'SLA Violado', value: d.sla_breached, icon: XCircle, color: 'text-red-400' },
              { label: 'Em Risco', value: d.at_risk, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Conformidade SLA', value: `${d.sla_compliance_pct}%`, icon: CheckCircle, color: d.sla_compliance_pct >= 90 ? 'text-emerald-400' : d.sla_compliance_pct >= 70 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Tempo Médio Resolução', value: `${Math.round(d.avg_resolution_minutes)}min`, icon: TrendingUp, color: 'text-indigo-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex items-center gap-3">
                <c.icon className={`w-8 h-8 ${c.color} flex-shrink-0`} />
                <div>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value ?? '–'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50"><h3 className="text-sm font-semibold text-white">Políticas de SLA</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Nome</th><th className="text-left p-4">Prioridade</th>
                <th className="text-left p-4">Resposta</th><th className="text-left p-4">Resolução</th>
                <th className="text-left p-4">Horário</th><th className="text-left p-4">Status</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  (policies as any[]).length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma política de SLA configurada</td></tr> :
                    (policies as any[]).map((pol: any) => (
                      <tr key={pol.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4 text-white font-medium">{pol.name}{pol.is_default && <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Padrão</span>}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[pol.priority]}`}>{PRIORITY_LABELS[pol.priority]}</span></td>
                        <td className="p-4 text-slate-300">{pol.response_hours}h</td>
                        <td className="p-4 text-slate-300">{pol.resolution_hours}h</td>
                        <td className="p-4 text-slate-300 text-xs">{pol.business_hours_only ? 'Comercial' : '24/7'}</td>
                        <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded ${pol.is_enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{pol.is_enabled ? 'Ativa' : 'Inativa'}</span></td>
                        <td className="p-4 flex gap-1">
                          <button onClick={() => { setEditing(pol); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(pol.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <SlaModal open={modal} onClose={() => setModal(false)} policy={editing} />
      </div>
    </Layout>
  );
}
