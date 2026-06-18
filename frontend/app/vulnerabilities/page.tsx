'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vulnsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
};
const SEV_LABELS: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };

const STATUS_COLORS: Record<string, string> = {
  open: 'text-red-400 bg-red-400/10', resolved: 'text-emerald-400 bg-emerald-400/10',
  accepted: 'text-amber-400 bg-amber-400/10', mitigated: 'text-blue-400 bg-blue-400/10',
};

export default function VulnerabilitiesPage() {
  const [tab, setTab] = useState<'summary' | 'list'>('summary');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: summary } = useQuery({ queryKey: ['vuln-summary'], queryFn: vulnsApi.summary });
  const { data: evData, isLoading } = useQuery({
    queryKey: ['endpoint-vulns', status, severity],
    queryFn: () => vulnsApi.listEndpointVulns({ status, severity }),
    enabled: tab === 'list',
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: any) => vulnsApi.updateEndpointVuln(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoint-vulns'] }),
  });

  const s = summary as any;
  const evItems = (evData as any)?.items || [];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vulnerabilidades</h1>
          <p className="text-slate-400 mt-1">Gerenciamento de vulnerabilidades nos endpoints</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 col-span-2 md:col-span-1">
            <p className="text-3xl font-bold text-white">{s?.total || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Total</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <p className="text-3xl font-bold text-red-400">{s?.by_severity?.critical || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Crítica</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <p className="text-3xl font-bold text-orange-400">{s?.by_severity?.high || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Alta</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <p className="text-3xl font-bold text-amber-400">{s?.by_severity?.medium || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Média</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <p className="text-3xl font-bold text-blue-400">{s?.by_severity?.low || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Baixa</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-700/50">
          {['summary', 'list'].map(t => (
            <button key={t} onClick={() => setTab(t as any)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
              {t === 'summary' ? 'Resumo' : 'Todas as Ocorrências'}
            </button>
          ))}
        </div>

        {tab === 'list' && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
            <div className="p-4 border-b border-slate-700/50 flex flex-wrap gap-3">
              <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Todos status</option>
                <option value="open">Aberta</option><option value="resolved">Resolvida</option>
                <option value="accepted">Aceita</option><option value="mitigated">Mitigada</option>
              </select>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Todas severidades</option>
                <option value="critical">Crítica</option><option value="high">Alta</option>
                <option value="medium">Média</option><option value="low">Baixa</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 border-b border-slate-700/50">
                  <th className="text-left p-4">CVE / Título</th>
                  <th className="text-left p-4">Severidade</th>
                  <th className="text-left p-4">CVSS</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Detectado</th>
                  <th className="text-left p-4">Ações</th>
                </tr></thead>
                <tbody>
                  {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                    evItems.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma vulnerabilidade encontrada</td></tr> :
                      evItems.map((ev: any) => (
                        <tr key={ev.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="p-4">
                            <p className="text-white font-medium">{ev.vulnerability?.cve_id || 'N/A'}</p>
                            <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{ev.vulnerability?.title}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded border text-xs font-medium ${SEV_COLORS[ev.vulnerability?.severity] || ''}`}>
                              {SEV_LABELS[ev.vulnerability?.severity] || ev.vulnerability?.severity}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300">{ev.vulnerability?.cvss_score ?? '–'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[ev.status] || ''}`}>{ev.status}</span>
                          </td>
                          <td className="p-4 text-slate-400 text-xs">{ev.detected_at ? new Date(ev.detected_at).toLocaleDateString('pt-BR') : '–'}</td>
                          <td className="p-4">
                            {ev.status === 'open' && (
                              <button onClick={() => updateMut.mutate({ id: ev.id, status: 'resolved' })} className="text-xs px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded transition-colors">Resolver</button>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'summary' && s && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Por Severidade</h3>
              <div className="space-y-3">
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = s.by_severity?.[sev] || 0;
                  const max = Math.max(...Object.values(s.by_severity || {}) as number[]);
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-16 ${SEV_COLORS[sev]?.split(' ')[0]}`}>{SEV_LABELS[sev]}</span>
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: max > 0 ? `${(count / max) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-sm text-white w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Status Geral</h3>
              <div className="flex flex-col items-center justify-center h-32">
                <p className="text-5xl font-bold text-white">{s.open || 0}</p>
                <p className="text-slate-400 text-sm mt-2">vulnerabilidades abertas</p>
                <div className="w-full h-2 bg-slate-700 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: s.total > 0 ? `${((s.total - s.open) / s.total) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{s.total > 0 ? Math.round(((s.total - s.open) / s.total) * 100) : 0}% resolvidas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
