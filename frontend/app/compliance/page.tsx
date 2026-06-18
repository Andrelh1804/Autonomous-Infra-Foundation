'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/services/api';
import Layout from '@/components/Layout';
import { ShieldCheck, Plus, Pencil, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_ICONS: Record<string, React.ElementType> = { pass: CheckCircle, fail: XCircle, unknown: AlertCircle };
const STATUS_COLORS: Record<string, string> = { pass: 'text-emerald-400', fail: 'text-red-400', unknown: 'text-slate-400' };

function PolicyModal({ open, onClose, policy }: { open: boolean; onClose: () => void; policy?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: policy?.name ?? '', description: policy?.description ?? '',
    framework: policy?.framework ?? 'custom', platform: policy?.platform ?? 'all', is_enabled: policy?.is_enabled ?? true,
  });
  const mut = useMutation({
    mutationFn: (d: any) => policy ? complianceApi.updatePolicy(policy.id, d) : complianceApi.createPolicy(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-policies'] }); onClose(); },
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{policy ? 'Editar Política' : 'Nova Política de Compliance'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Framework</label>
              <select value={form.framework} onChange={e => setForm(f => ({ ...f, framework: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="custom">Personalizado</option><option value="cis">CIS Benchmark</option>
                <option value="nist">NIST</option><option value="iso27001">ISO 27001</option><option value="lgpd">LGPD</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Plataforma</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="all">Todas</option><option value="windows">Windows</option>
                <option value="linux">Linux</option><option value="macos">macOS</option>
              </select></div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: policies = [], isLoading } = useQuery({ queryKey: ['compliance-policies'], queryFn: complianceApi.listPolicies });
  const { data: summary } = useQuery({ queryKey: ['compliance-summary'], queryFn: complianceApi.summary });
  const delMut = useMutation({ mutationFn: (id: number) => complianceApi.deletePolicy(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-policies'] }) });
  const s = summary as any;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Compliance</h1><p className="text-slate-400 mt-1">Políticas de conformidade e verificações de segurança</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Nova Política
          </button>
        </div>
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Verificações', value: s.total_checks, color: 'text-white' },
              { label: 'Aprovadas', value: s.passed, color: 'text-emerald-400' },
              { label: 'Reprovadas', value: s.failed, color: 'text-red-400' },
              { label: 'Conformidade', value: `${s.compliance_pct}%`, color: s.compliance_pct >= 80 ? 'text-emerald-400' : s.compliance_pct >= 60 ? 'text-amber-400' : 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value ?? '–'}</p>
                <p className="text-sm text-slate-400 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50"><h3 className="text-sm font-semibold text-white">Políticas de Compliance</h3></div>
          <div className="divide-y divide-slate-700/30">
            {isLoading ? <div className="p-8 text-center text-slate-400">Carregando...</div> :
              (policies as any[]).length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma política cadastrada</div> :
                (policies as any[]).map((pol: any) => (
                  <div key={pol.id} className="p-4 flex items-center justify-between hover:bg-slate-700/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${pol.is_enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      <div>
                        <p className="text-white font-medium">{pol.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{pol.framework?.toUpperCase()} · {pol.platform}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${pol.is_enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {pol.is_enabled ? 'Ativa' : 'Inativa'}
                      </span>
                      <button onClick={() => { setEditing(pol); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(pol.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
          </div>
        </div>
        <PolicyModal open={modal} onClose={() => setModal(false)} policy={editing} />
      </div>
    </Layout>
  );
}
