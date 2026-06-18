'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patchesApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Shield, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  important: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  moderate: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  installed: CheckCircle, pending: Clock, failed: XCircle,
};
const STATUS_COLORS: Record<string, string> = {
  installed: 'text-emerald-400', pending: 'text-amber-400', failed: 'text-red-400',
};

export default function PatchesPage() {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);

  const { data: summary } = useQuery({ queryKey: ['patch-summary'], queryFn: patchesApi.summary });
  const { data, isLoading } = useQuery({
    queryKey: ['endpoint-patches', status, severity, page],
    queryFn: () => patchesApi.listEndpointPatches({ status, severity, page, per_page: 50 }),
  });

  const items = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  const s = summary as any;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Patches</h1>
          <p className="text-slate-400 mt-1">Status de patches e atualizações nos endpoints</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: s?.total, color: 'text-white' },
            { label: 'Pendentes', value: s?.pending, color: 'text-amber-400' },
            { label: 'Instalados', value: s?.installed, color: 'text-emerald-400' },
            { label: 'Com Falha', value: s?.failed, color: 'text-red-400' },
            { label: 'Críticos', value: s?.critical, color: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <p className={`text-2xl font-bold ${c.color}`}>{c.value ?? 0}</p>
              <p className="text-sm text-slate-400 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex flex-wrap gap-3">
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option>
              <option value="pending">Pendente</option><option value="installed">Instalado</option>
              <option value="failed">Com Falha</option>
            </select>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas severidades</option>
              <option value="critical">Crítico</option><option value="important">Importante</option>
              <option value="moderate">Moderado</option><option value="low">Baixo</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Patch / KB</th>
                <th className="text-left p-4">Severidade</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Endpoint</th>
                <th className="text-left p-4">Requer Reinício</th>
                <th className="text-left p-4">Detectado</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum patch encontrado</td></tr> :
                    items.map((ep: any) => {
                      const SIcon = STATUS_ICONS[ep.status] || Clock;
                      return (
                        <tr key={ep.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="p-4">
                            <p className="text-white font-medium">{ep.patch?.title || `Patch #${ep.patch_id}`}</p>
                            {ep.patch?.kb_article && <p className="text-xs text-slate-400 mt-0.5">KB{ep.patch.kb_article}</p>}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded border text-xs ${SEV_COLORS[ep.patch?.severity] || 'text-slate-400 bg-slate-400/10'}`}>
                              {ep.patch?.severity || '–'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <SIcon className={`w-4 h-4 ${STATUS_COLORS[ep.status]}`} />
                              <span className={`text-xs ${STATUS_COLORS[ep.status]}`}>{ep.status}</span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300">#{ep.endpoint_id}</td>
                          <td className="p-4">
                            {ep.patch?.requires_reboot ? (
                              <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Sim</span>
                            ) : (
                              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">Não</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400 text-xs">{ep.detected_at ? new Date(ep.detected_at).toLocaleDateString('pt-BR') : '–'}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-slate-400 border-t border-slate-700/50">{total} patches encontrados</div>
        </div>
      </div>
    </Layout>
  );
}
