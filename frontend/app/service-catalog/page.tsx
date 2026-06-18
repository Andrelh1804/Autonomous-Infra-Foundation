'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceCatalogApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Package, Plus, Pencil, Trash2, Send, User, Clock, CheckCircle } from 'lucide-react';

const CATEGORY_ICONS: Record<string, string> = {
  'Acesso': '🔑', 'Hardware': '💻', 'Software': '📦', 'Rede': '🌐',
  'Usuário': '👤', 'Impressora': '🖨️', 'Email': '📧', 'VPN': '🔒',
};

function CatalogModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: item?.name ?? '', description: item?.description ?? '', category: item?.category ?? '',
    icon: item?.icon ?? 'package', sla_hours: item?.sla_hours ?? 8,
    requires_approval: item?.requires_approval ?? false, is_enabled: item?.is_enabled ?? true, order: item?.order ?? 0,
  });
  const mut = useMutation({
    mutationFn: (d: any) => item ? serviceCatalogApi.update(item.id, d) : serviceCatalogApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-catalog'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{item ? 'Editar Item' : 'Novo Item do Catálogo'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">SLA (horas)</label>
              <input type="number" value={form.sla_hours} onChange={e => set('sla_hours', parseFloat(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="req_approval" checked={form.requires_approval} onChange={e => set('requires_approval', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="req_approval" className="text-sm text-slate-300">Requer aprovação</label>
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

export default function ServiceCatalogPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [requestModal, setRequestModal] = useState<any>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['service-catalog', search], queryFn: () => serviceCatalogApi.list({ search }) });
  const delMut = useMutation({ mutationFn: (id: number) => serviceCatalogApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['service-catalog'] }) });
  const requestMut = useMutation({ mutationFn: (id: number) => serviceCatalogApi.request(id, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setRequestModal(null); alert('Solicitação criada com sucesso!'); } });
  const items = data as any[];
  const categories = [...new Set(items.map((i: any) => i.category).filter(Boolean))];
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Catálogo de Serviços</h1><p className="text-slate-400 mt-1">Solicite serviços de TI de forma padronizada</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Novo Item
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviço..." className="w-full max-w-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
        {isLoading ? <div className="text-center text-slate-400 py-8">Carregando...</div> :
          items.length === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-12 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Catálogo vazio. Adicione itens para que os usuários possam solicitar serviços.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item: any) => (
                <div key={item.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-indigo-500/50 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg">
                      {CATEGORY_ICONS[item.category] || '📋'}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(item); setModal(true); }} className="p-1 text-slate-400 hover:text-indigo-400 rounded"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(item.id); }} className="p-1 text-slate-400 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <h3 className="text-white font-medium text-sm mb-1">{item.name}</h3>
                  {item.description && <p className="text-slate-400 text-xs mb-3 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center gap-2 mb-4">
                    {item.category && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{item.category}</span>}
                    {item.requires_approval && <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Aprovação</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> SLA: {item.sla_hours}h</span>
                    <button onClick={() => requestMut.mutate(item.id)} disabled={requestMut.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                      <Send className="w-3 h-3" /> Solicitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        <CatalogModal open={modal} onClose={() => setModal(false)} item={editing} />
      </div>
    </Layout>
  );
}
