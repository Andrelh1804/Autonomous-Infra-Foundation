'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi, permissionsApi } from '@/services/api';
import Layout from '@/components/Layout';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import type { Role, Permission } from '@/types';

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<any>({ name: '', description: '', permission_ids: [] });
  const [error, setError] = useState('');

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list().then(r => r.data),
  });

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.list().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? rolesApi.update(editing.id, d) : rolesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); closeModal(); },
    onError: (e: any) => setError(e.response?.data?.detail || 'Erro ao salvar'),
  });

  const del = useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setDeleteConfirm(null); },
  });

  function openCreate() { setEditing(null); setForm({ name: '', description: '', permission_ids: [] }); setError(''); setModalOpen(true); }
  function openEdit(r: Role) {
    setEditing(r);
    const ids = permissions?.filter(p => r.permissions.includes(p.name)).map(p => p.id) ?? [];
    setForm({ name: r.name, description: r.description ?? '', permission_ids: ids });
    setError(''); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); setError(''); }

  const moduleGroups = permissions?.reduce((acc: Record<string, Permission[]>, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {}) ?? {};

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Perfis & Permissões</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerenciar controle de acesso</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Novo Perfil
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-36 animate-pulse" />
            ))
          ) : (
            roles?.map(role => (
              <div key={role.id} className="bg-card border border-border rounded-xl p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600/10 rounded-lg flex items-center justify-center">
                      <Lock className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{role.name.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(role)} className="p-1.5 rounded hover:bg-accent transition text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteConfirm(role)} className="p-1.5 rounded hover:bg-red-500/10 transition text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 6).map(p => <Badge key={p} variant="default">{p}</Badge>)}
                  {role.permissions.length > 6 && <Badge variant="info">+{role.permissions.length - 6} mais</Badge>}
                  {role.permissions.length === 0 && <span className="text-xs text-muted-foreground">Sem permissões</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Perfil' : 'Novo Perfil'} size="lg">
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome *</label>
            <input className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Descrição</label>
            <input className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Permissões</label>
            <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto scrollbar-thin">
              {Object.entries(moduleGroups).map(([module, perms]) => (
                <div key={module}>
                  <div className="px-3 py-1.5 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{module}</div>
                  {perms.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-0">
                      <input type="checkbox" className="accent-indigo-600"
                        checked={form.permission_ids?.includes(p.id)}
                        onChange={e => setForm((prev: any) => ({
                          ...prev,
                          permission_ids: e.target.checked
                            ? [...(prev.permission_ids || []), p.id]
                            : (prev.permission_ids || []).filter((id: number) => id !== p.id)
                        }))} />
                      <span className="text-sm font-mono text-xs">{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{p.description}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeModal} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancelar</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition">
              {save.isPending ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Excluir Perfil" size="sm">
        <p className="text-sm text-muted-foreground mb-4">Excluir o perfil <strong className="text-foreground">{deleteConfirm?.name}</strong>?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancelar</button>
          <button onClick={() => del.mutate(deleteConfirm!.id)} disabled={del.isPending}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 transition">
            {del.isPending ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
