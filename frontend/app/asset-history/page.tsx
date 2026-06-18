'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { Asset, AssetHistory, PaginatedResponse } from '@/types';
import { History, ChevronDown, ChevronRight, Search, Loader2, User, Cpu, Radar } from 'lucide-react';

function ChangeRow({ history }: { history: AssetHistory }) {
  const [open, setOpen] = useState(false);
  let changes: Record<string, { before: any; after: any }> = {};
  try {
    changes = history.changes ? JSON.parse(history.changes) : {};
  } catch {}

  const fields = Object.keys(changes);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              history.change_source === 'discovery' ? 'bg-indigo-500/10 text-indigo-400' :
              history.change_source === 'manual'    ? 'bg-amber-500/10 text-amber-400' :
              'bg-slate-500/10 text-slate-400'
            }`}>
              {history.change_source === 'discovery'
                ? <span className="flex items-center gap-1"><Radar className="w-3 h-3 inline" /> Discovery</span>
                : history.change_source === 'manual' ? 'Manual' : history.change_source}
            </span>
            <span className="text-sm font-medium">{fields.length} campo{fields.length !== 1 ? 's' : ''} alterado{fields.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-muted-foreground hidden md:block">{fields.join(', ')}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(history.created_at)}</span>
      </button>

      {open && fields.length > 0 && (
        <div className="px-5 pb-4 pl-12">
          <div className="bg-muted/30 rounded-lg overflow-hidden border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Campo</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Antes</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map(field => (
                  <tr key={field}>
                    <td className="px-3 py-2 font-mono font-medium">{field}</td>
                    <td className="px-3 py-2 text-red-400 line-through">{String(changes[field].before ?? '—')}</td>
                    <td className="px-3 py-2 text-emerald-400">{String(changes[field].after ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetHistoryPage() {
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: assetsData } = useQuery<PaginatedResponse<Asset>>({
    queryKey: ['assets-all-hist'],
    queryFn: () => assetsApi.list({ per_page: 500 }).then(r => r.data),
  });

  const { data: history, isLoading } = useQuery<AssetHistory[]>({
    queryKey: ['asset-history', selectedAssetId],
    queryFn: () => assetsApi.history(selectedAssetId!).then(r => r.data),
    enabled: !!selectedAssetId,
  });

  const assets = assetsData?.items ?? [];
  const filtered = assets.filter(a =>
    !search || (a.hostname || a.ip_address || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  const statusLabel: Record<string, string> = {
    active: 'Ativo', inactive: 'Inativo', maintenance: 'Manutenção',
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Ativos</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe todas as alterações em seus ativos ao longo do tempo</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar ativos…"
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhum ativo encontrado</div>
                ) : (
                  filtered.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssetId(a.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/30 transition flex items-start gap-3 ${selectedAssetId === a.id ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : ''}`}
                    >
                      <Cpu className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.hostname || a.ip_address || `Ativo #${a.id}`}</p>
                        <p className="text-xs text-muted-foreground">{a.asset_type?.name ?? '—'} · {statusLabel[a.status] || a.status}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <History className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="font-semibold text-sm">
                    {selectedAsset ? `${selectedAsset.hostname || selectedAsset.ip_address || `Ativo #${selectedAsset.id}`}` : 'Histórico de Alterações'}
                  </h2>
                  {selectedAsset && (
                    <p className="text-xs text-muted-foreground">{selectedAsset.asset_type?.name} · {statusLabel[selectedAsset.status] || selectedAsset.status}</p>
                  )}
                </div>
                {history && <span className="ml-auto text-xs text-muted-foreground">{history.length} alteraç{history.length !== 1 ? 'ões' : 'ão'}</span>}
              </div>

              {!selectedAssetId ? (
                <div className="p-12 text-center">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground text-sm">Selecione um ativo da lista para ver seu histórico de alterações</p>
                </div>
              ) : isLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !history || history.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground text-sm">Nenhum histórico de alterações para este ativo ainda</p>
                </div>
              ) : (
                <div>
                  {history.map(h => <ChangeRow key={h.id} history={h} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
