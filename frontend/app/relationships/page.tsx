'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, discoveryApi } from '@/services/api';
import Layout from '@/components/Layout';
import type { Asset, AssetRelationship, PaginatedResponse } from '@/types';
import { GitFork, Plus, Trash2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

const REL_TYPES = [
  'hosts', 'runs', 'connects_to', 'depends_on', 'backs_up',
  'virtualizes', 'manages', 'uses_database', 'prints_via',
  'routes_through', 'protected_by',
];

const REL_TYPE_LABELS: Record<string, string> = {
  hosts:          'hospeda',
  runs:           'executa',
  connects_to:    'conecta-se a',
  depends_on:     'depende de',
  backs_up:       'faz backup de',
  virtualizes:    'virtualiza',
  manages:        'gerencia',
  uses_database:  'usa banco de dados',
  prints_via:     'imprime via',
  routes_through: 'roteia por',
  protected_by:   'protegido por',
};

const REL_COLORS: Record<string, string> = {
  hosts:          'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  runs:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  connects_to:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  depends_on:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  backs_up:       'bg-teal-500/10 text-teal-400 border-teal-500/30',
  virtualizes:    'bg-purple-500/10 text-purple-400 border-purple-500/30',
  manages:        'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  uses_database:  'bg-violet-500/10 text-violet-400 border-violet-500/30',
  prints_via:     'bg-rose-500/10 text-rose-400 border-rose-500/30',
  routes_through: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  protected_by:   'bg-red-500/10 text-red-400 border-red-500/30',
};

function AddRelModal({ open, onClose, assets }: { open: boolean; onClose: () => void; assets: Asset[] }) {
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('connects_to');
  const [description, setDescription] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => assetsApi.addRelationship(parseInt(sourceId), {
      target_asset_id: parseInt(targetId),
      relationship_type: relType,
      description: description || undefined,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-relationships'] });
      onClose();
      setSourceId(''); setTargetId(''); setRelType('connects_to'); setDescription('');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adicionar Relacionamento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ativo de Origem</label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Selecionar origem —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.hostname || a.ip_address || `Ativo #${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Relacionamento</label>
            <select value={relType} onChange={e => setRelType(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {REL_TYPES.map(t => <option key={t} value={t}>{REL_TYPE_LABELS[t] || t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ativo de Destino</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Selecionar destino —</option>
              {assets.filter(a => String(a.id) !== sourceId).map(a => <option key={a.id} value={a.id}>{a.hostname || a.ip_address || `Ativo #${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="font-normal">(opcional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              {(error as any)?.response?.data?.detail || 'Falha ao adicionar relacionamento'}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancelar</button>
            <button
              onClick={() => mutate()}
              disabled={isPending || !sourceId || !targetId}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar Relacionamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RelationshipsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: assetsData } = useQuery<{ items: Asset[] }>({
    queryKey: ['assets-all'],
    queryFn: () => assetsApi.list({ per_page: 500 }).then(r => r.data),
  });

  const { data: rels, isLoading } = useQuery<AssetRelationship[]>({
    queryKey: ['all-relationships'],
    queryFn: () => discoveryApi.allRelationships().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assetsApi.deleteRelationship(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-relationships'] }),
  });

  const assets = assetsData?.items ?? [];

  const assetName = (id: number) => {
    const a = assets.find(x => x.id === id);
    return a ? (a.hostname || a.ip_address || `#${id}`) : `#${id}`;
  };

  const grouped = (rels ?? []).reduce<Record<string, AssetRelationship[]>>((acc, r) => {
    if (!acc[r.relationship_type]) acc[r.relationship_type] = [];
    acc[r.relationship_type].push(r);
    return acc;
  }, {});

  return (
    <Layout>
      <AddRelModal open={showModal} onClose={() => setShowModal(false)} assets={assets} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Motor de Relacionamentos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Mapeie dependências e conexões entre ativos
            </p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            Adicionar Relacionamento
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total de Relacionamentos</p>
            <p className="text-2xl font-bold mt-1">{rels?.length ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Tipos de Relacionamento</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(grouped).length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Ativos Vinculados</p>
            <p className="text-2xl font-bold mt-1">
              {new Set((rels ?? []).flatMap(r => [r.source_asset_id, r.target_asset_id])).size}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total de Ativos</p>
            <p className="text-2xl font-bold mt-1">{assets.length}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (rels?.length ?? 0) === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <GitFork className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">Nenhum relacionamento definido ainda. Adicione conexões entre ativos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, group]) => {
              const color = REL_COLORS[type] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
              return (
                <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
                      {REL_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.length} relacionamento{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {group.map(rel => (
                      <div key={rel.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-sm truncate">{assetName(rel.source_asset_id)}</span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{assetName(rel.target_asset_id)}</span>
                          {rel.description && (
                            <span className="text-xs text-muted-foreground ml-2 hidden md:block truncate">— {rel.description}</span>
                          )}
                        </div>
                        <button onClick={() => { if (confirm('Excluir relacionamento?')) deleteMutation.mutate(rel.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
