'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi } from '@/services/api';
import Layout from '@/components/Layout';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { Plus, Search, Pencil, Trash2, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Site, PaginatedResponse } from '@/types';

const EMPTY = { name: '', address: '', city: '', state: '', country: '' };

export default function SitesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Site | null>(null);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<PaginatedResponse<Site>>({
    queryKey: ['sites', page, search],
    queryFn: () => sitesApi.list({ page, per_page: 20, search: search || undefined }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? sitesApi.update(editing.id, d) : sitesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); closeModal(); },
    onError: (e: any) => setError(e.response?.data?.detail || 'Error saving'),
  });

  const del = useMutation({
    mutationFn: (id: number) => sitesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setDeleteConfirm(null); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(s: Site) { setEditing(s); setForm(s); setError(''); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); setError(''); }

  const columns = [
    {
      key: 'name', label: 'Site',
      render: (r: Site) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium">{r.name}</span>
        </div>
      )
    },
    { key: 'address', label: 'Address', render: (r: Site) => r.address || '—' },
    {
      key: 'location', label: 'Location',
      render: (r: Site) => [r.city, r.state, r.country].filter(Boolean).join(', ') || '—'
    },
    { key: 'created_at', label: 'Created', render: (r: Site) => formatDate(r.created_at) },
    {
      key: 'actions', label: '', className: 'w-20',
      render: (r: Site) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteConfirm(r)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const fields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'country', label: 'Country' },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sites</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage physical locations</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> New Site
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search sites..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} total={data?.total ?? 0} page={page} perPage={20} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Site' : 'New Site'}>
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>}
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1.5">{f.label}{f.required ? ' *' : ''}</label>
              <input className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form[f.key] ?? ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))} required={f.required} />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeModal} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancel</button>
            <button onClick={() => save.mutate(form)} disabled={save.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition">
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Site" size="sm">
        <p className="text-sm text-muted-foreground mb-4">Delete site <strong className="text-foreground">{deleteConfirm?.name}</strong>?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">Cancel</button>
          <button onClick={() => del.mutate(deleteConfirm!.id)} disabled={del.isPending}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 transition">
            {del.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
