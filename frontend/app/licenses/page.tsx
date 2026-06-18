'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Key, Plus, Pencil, Trash2, AlertTriangle, DollarSign, Package } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10', expired: 'text-red-400 bg-red-400/10',
  expiring_soon: 'text-amber-400 bg-amber-400/10', inactive: 'text-slate-400 bg-slate-400/10',
};

function LicenseModal({ open, onClose, license }: { open: boolean; onClose: () => void; license?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    vendor: license?.vendor ?? '', product: license?.product ?? '', edition: license?.edition ?? '',
    version: license?.version ?? '', license_type: license?.license_type ?? 'per_seat',
    quantity: license?.quantity ?? 1, cost_per_unit: license?.cost_per_unit ?? '',
    currency: license?.currency ?? 'BRL', cost_center: license?.cost_center ?? '',
    purchase_date: license?.purchase_date ?? '', expiry_date: license?.expiry_date ?? '',
    renewal_date: license?.renewal_date ?? '', license_key: license?.license_key ?? '',
    notes: license?.notes ?? '', status: license?.status ?? 'active',
  });
  const mut = useMutation({
    mutationFn: (d: any) => license ? licensesApi.update(license.id, d) : licensesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['licenses'] }); onClose(); },
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{license ? 'Editar Licença' : 'Nova Licença'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[['vendor','Fornecedor'],['product','Produto'],['edition','Edição'],['version','Versão']].map(([k,l]) => (
              <div key={k}><label className="text-xs text-slate-400 mb-1 block">{l}</label>
                <input value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
              <select value={form.license_type} onChange={e => set('license_type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="per_seat">Por Assento</option><option value="per_device">Por Dispositivo</option>
                <option value="site">Site License</option><option value="subscription">Assinatura</option>
                <option value="perpetual">Perpétua</option><option value="oem">OEM</option>
              </select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Qtd</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Custo Unit.</label>
              <input type="number" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[['purchase_date','Compra'],['expiry_date','Vencimento'],['renewal_date','Renovação']].map(([k,l]) => (
              <div key={k}><label className="text-xs text-slate-400 mb-1 block">{l}</label>
                <input type="date" value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            ))}
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Chave / Serial</label>
            <input value={form.license_key} onChange={e => set('license_key', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
            {mut.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LicensesPage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['licenses', search], queryFn: () => licensesApi.list({ search }) });
  const { data: summary } = useQuery({ queryKey: ['licenses-summary'], queryFn: licensesApi.summary });
  const delMut = useMutation({ mutationFn: (id: number) => licensesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['licenses'] }) });
  const items = (data as any)?.items || [];
  const s = summary as any;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Licenciamento</h1><p className="text-slate-400 mt-1">Gestão de licenças de software</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Nova Licença
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Licenças', value: s?.total_licenses, icon: Key, color: 'bg-indigo-500/10 text-indigo-400' },
            { label: 'Total de Assentos', value: s?.total_seats, icon: Package, color: 'bg-emerald-500/10 text-emerald-400' },
            { label: 'A Vencer', value: s?.expiring_soon, icon: AlertTriangle, color: 'bg-amber-500/10 text-amber-400' },
            { label: 'Custo Anual', value: s?.total_annual_cost ? `R$ ${Number(s.total_annual_cost).toLocaleString('pt-BR')}` : 'R$ 0', icon: DollarSign, color: 'bg-violet-500/10 text-violet-400' },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}><c.icon className="w-6 h-6" /></div>
              <div><p className="text-xl font-bold text-white">{c.value ?? '–'}</p><p className="text-sm text-slate-400">{c.label}</p></div>
            </div>
          ))}
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por produto ou fornecedor..." className="w-full max-w-sm bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Produto</th><th className="text-left p-4">Fornecedor</th>
                <th className="text-left p-4">Tipo</th><th className="text-left p-4">Qtd / Usado</th>
                <th className="text-left p-4">Vencimento</th><th className="text-left p-4">Status</th>
                <th className="text-left p-4">Ações</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma licença cadastrada</td></tr> :
                    items.map((l: any) => (
                      <tr key={l.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4 text-white font-medium">{l.product}{l.edition ? ` (${l.edition})` : ''}</td>
                        <td className="p-4 text-slate-300">{l.vendor}</td>
                        <td className="p-4 text-slate-300">{l.license_type}</td>
                        <td className="p-4 text-slate-300">{l.used_count}/{l.quantity}</td>
                        <td className="p-4 text-slate-300">{l.expiry_date || '–'}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[l.status] || ''}`}>{l.status}</span></td>
                        <td className="p-4 flex gap-2">
                          <button onClick={() => { setEditing(l); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(l.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <LicenseModal open={modal} onClose={() => setModal(false)} license={editing} />
      </div>
    </Layout>
  );
}
