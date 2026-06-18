'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { FileText, Plus, Pencil, Trash2, Shield } from 'lucide-react';

function PolicyModal({ open, onClose, policy }: { open: boolean; onClose: () => void; policy?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: policy?.name ?? '', description: policy?.description ?? '',
    platform: policy?.platform ?? 'all', category: policy?.category ?? 'security', is_enabled: policy?.is_enabled ?? true,
  });
  const mut = useMutation({
    mutationFn: (d: any) => policy ? policiesApi.update(policy.id, d) : policiesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); onClose(); },
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{policy ? 'Editar Política' : 'Nova Política'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Plataforma</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="all">Todas</option><option value="windows">Windows</option><option value="linux">Linux</option><option value="macos">macOS</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="security">Segurança</option><option value="compliance">Compliance</option>
                <option value="performance">Performance</option><option value="software">Software</option>
                <option value="patch">Patch</option><option value="custom">Personalizado</option>
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

export default function PoliciesPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [platform, setPlatform] = useState('');
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['policies', platform], queryFn: () => policiesApi.list({ platform }) });
  const delMut = useMutation({ mutationFn: (id: number) => policiesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }) });
  const CATEGORY_COLORS: Record<string, string> = { security: 'bg-red-500/10 text-red-400', compliance: 'bg-purple-500/10 text-purple-400', performance: 'bg-blue-500/10 text-blue-400', software: 'bg-indigo-500/10 text-indigo-400', patch: 'bg-amber-500/10 text-amber-400', custom: 'bg-slate-500/10 text-slate-400' };
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Políticas</h1><p className="text-slate-400 mt-1">Políticas de configuração e segurança para endpoints</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Nova Política
          </button>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50">
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas plataformas</option><option value="windows">Windows</option>
              <option value="linux">Linux</option><option value="macos">macOS</option>
            </select>
          </div>
          <div className="divide-y divide-slate-700/30">
            {isLoading ? <div className="p-8 text-center text-slate-400">Carregando...</div> :
              (data as any[]).length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma política encontrada</div> :
                (data as any[]).map((pol: any) => (
                  <div key={pol.id} className="p-4 flex items-center justify-between hover:bg-slate-700/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{pol.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[pol.category] || 'bg-slate-500/10 text-slate-400'}`}>{pol.category}</span>
                          <span className="text-xs text-slate-400">{pol.platform}</span>
                        </div>
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
