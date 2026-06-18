'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi } from '@/services/api';
import Layout from '@/components/Layout';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Organization, PaginatedResponse } from '@/types';

const EMPTY: Organization = { id: 0, uuid: '', name: '', company_name: '', document: '', status: 'active', created_at: '' };

export default function OrgsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Organization | null>(null);
  const [form, setForm] = useState<Partial<Organization>>(EMPTY);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<PaginatedResponse<Organization>>({
    queryKey: ['organizations', page, search],
    queryFn: () => orgsApi.list({ page, per_page: 20, search: search || undefined }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: Partial<Organization>) =>
      editing ? orgsApi.update(editing.id, d) : orgsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organizations'] }); closeModal(); },
    onError: (e: any) => setError(e.response?.data?.detail || 'Error saving'),
  });

  const del = useMutation({
    mutationFn: (id: number) => orgsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organizations'] }); setDeleteConfirm(null); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(o: Organization) { setEditing(o); setForm(o); setError(''); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); setForm(EMPTY); setError(''); }

  const columns = [
    { key: 'name', label: 'Name', render: (r: Organization) => <span className="font-medium">{r.name}</span> },
    { key: 'company_name', label: 'Company' },
    { key: 'document', label: 'Document' },
    {
      key: 'status', label: 'Status',
      render: (r: Organization) => <Badge variant={r.status === 'active' ? 'success' : 'danger'}>{r.status}</Badge>
    },
    { key: 'created_at', label: 'Created', render: (r: Organization) => formatDate(r.created_at) },
    {
      key: 'actions', label: '',
      render: (r: Organization) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteConfirm(r)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-muted-foreground hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Organizations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage tenant organizations</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> New Organization
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search organizations..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          total={data?.total ?? 0}
          page={page}
          perPage={20}
          onPageChange={setPage}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Organization' : 'New Organization'}>
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>}
        <div className="space-y-4">
          {(['name', 'company_name', 'document'] as const).map(f => (
            <div key={f}>
              <label className="block text-sm font-medium mb-1.5 capitalize">{f.replace('_', ' ')}{f === 'name' ? ' *' : ''}</label>
              <input
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={(form as any)[f] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                required={f === 'name'}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.status ?? 'active'}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeModal} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancel</button>
            <button
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition"
            >
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Organization" size="sm">
        <p className="text-sm text-muted-foreground mb-4">Are you sure you want to delete <strong className="text-foreground">{deleteConfirm?.name}</strong>? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancel</button>
          <button onClick={() => del.mutate(deleteConfirm!.id)} disabled={del.isPending} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 transition">
            {del.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
