'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '@/services/api';
import Layout from '@/components/Layout';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Plus, Search, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { User, Role, PaginatedResponse } from '@/types';

export default function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<any>({ first_name: '', last_name: '', email: '', password: '', active: true, role_ids: [] });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, per_page: 20, search: search || undefined }).then(r => r.data),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? usersApi.update(editing.id, d) : usersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); closeModal(); },
    onError: (e: any) => setError(e.response?.data?.detail || 'Erro ao salvar'),
  });

  const del = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteConfirm(null); },
  });

  function openCreate() {
    setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', password: '', active: true, role_ids: [] });
    setError(''); setModalOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, active: u.active, role_ids: [] });
    setError(''); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); setError(''); }

  const columns = [
    {
      key: 'name', label: 'Usuário',
      render: (r: User) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
            {r.first_name[0]}{r.last_name[0]}
          </div>
          <div>
            <p className="font-medium text-sm">{r.first_name} {r.last_name}</p>
            <p className="text-xs text-muted-foreground">{r.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'roles', label: 'Perfis',
      render: (r: User) => r.is_super_admin
        ? <Badge variant="info"><ShieldCheck className="w-3 h-3 mr-1" />Super Admin</Badge>
        : r.roles.length ? r.roles.map(role => <Badge key={role} variant="default" >{role}</Badge>) : '—'
    },
    { key: 'active', label: 'Status', render: (r: User) => <Badge variant={r.active ? 'success' : 'danger'}>{r.active ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'last_login', label: 'Último Login', render: (r: User) => r.last_login ? formatDate(r.last_login) : '—' },
    {
      key: 'actions', label: '', className: 'w-20',
      render: (r: User) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteConfirm(r)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerenciar usuários da plataforma</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Buscar usuários..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} total={data?.total ?? 0} page={page} perPage={20} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Usuário' : 'Novo Usuário'}>
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[{ key: 'first_name', label: 'Nome' }, { key: 'last_name', label: 'Sobrenome' }].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1.5">{f.label} *</label>
                <input className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form[f.key] ?? ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))} required />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">E-mail *</label>
            <input type="email" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.email ?? ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} required />
          </div>
          {!editing && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Senha *</label>
              <input type="password" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.password ?? ''} onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))} required />
            </div>
          )}
          {roles && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Perfis</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin border border-border rounded-lg p-2">
                {roles.map(r => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent px-2 py-1 rounded">
                    <input type="checkbox" className="accent-indigo-600"
                      checked={form.role_ids?.includes(r.id)}
                      onChange={e => setForm((p: any) => ({
                        ...p,
                        role_ids: e.target.checked ? [...(p.role_ids || []), r.id] : (p.role_ids || []).filter((id: number) => id !== r.id)
                      }))} />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {editing && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-indigo-600" checked={form.active ?? true}
                  onChange={e => setForm((p: any) => ({ ...p, active: e.target.checked }))} />
                <span className="text-sm font-medium">Ativo</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeModal} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancelar</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition">
              {save.isPending ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Excluir Usuário" size="sm">
        <p className="text-sm text-muted-foreground mb-4">Excluir <strong className="text-foreground">{deleteConfirm?.email}</strong>?</p>
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
