'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { endpointsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Server, Monitor, Terminal, Apple, Wifi, WifiOff, Shield, RefreshCw } from 'lucide-react';

const PLATFORM_ICONS: Record<string, React.ElementType> = { windows: Monitor, linux: Terminal, macos: Apple };
const STATUS_COLORS: Record<string, string> = {
  online: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  offline: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  unknown: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

export default function EndpointsPage() {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [agentStatus, setAgentStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['endpoints', search, platform, agentStatus],
    queryFn: () => endpointsApi.list({ search, platform, agent_status: agentStatus }),
    refetchInterval: 30000,
  });
  const { data: stats } = useQuery({ queryKey: ['endpoint-stats'], queryFn: endpointsApi.getStats, refetchInterval: 30000 });

  const items = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  const s = stats as any;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Endpoints Gerenciados</h1>
            <p className="text-slate-400 mt-1">Todos os dispositivos com agente instalado</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: s.total, c: 'text-white' },
              { label: 'Online', value: s.online, c: 'text-emerald-400' },
              { label: 'Offline', value: s.offline, c: 'text-slate-400' },
              { label: 'Windows', value: s.by_platform?.windows, c: 'text-blue-400' },
              { label: 'Linux', value: s.by_platform?.linux, c: 'text-orange-400' },
              { label: 'macOS', value: s.by_platform?.macos, c: 'text-purple-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <p className={`text-2xl font-bold ${c.c}`}>{c.value ?? 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por hostname ou IP..." className="flex-1 min-w-48 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todas plataformas</option>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
              <option value="macos">macOS</option>
            </select>
            <select value={agentStatus} onChange={e => setAgentStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Hostname</th>
                <th className="text-left p-4">IP</th>
                <th className="text-left p-4">SO</th>
                <th className="text-left p-4">CPU</th>
                <th className="text-left p-4">RAM</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Risco</th>
                <th className="text-left p-4">Patch</th>
                <th className="text-left p-4">Compliance</th>
                <th className="text-left p-4">Último Checkin</th>
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-slate-400">Carregando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-slate-400">Nenhum endpoint encontrado</td></tr>
                ) : items.map((ep: any) => {
                  const PIcon = PLATFORM_ICONS[ep.platform] || Server;
                  return (
                    <tr key={ep.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <PIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-white font-medium">{ep.hostname}</p>
                            {ep.fqdn && ep.fqdn !== ep.hostname && <p className="text-xs text-slate-500">{ep.fqdn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300 font-mono text-xs">{ep.ip_address || '–'}</td>
                      <td className="p-4">
                        <p className="text-slate-200 text-xs">{ep.os_name || '–'}</p>
                        <p className="text-slate-500 text-xs">{ep.os_version || ''}</p>
                      </td>
                      <td className="p-4 text-slate-300 text-xs">{ep.cpu_model ? `${ep.cpu_cores}c` : '–'}</td>
                      <td className="p-4 text-slate-300 text-xs">{ep.ram_gb ? `${ep.ram_gb} GB` : '–'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${STATUS_COLORS[ep.agent_status] || STATUS_COLORS.unknown}`}>
                          {ep.agent_status === 'online' ? 'Online' : ep.agent_status === 'offline' ? 'Offline' : 'Desconhecido'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${ep.risk_score > 70 ? 'bg-red-500' : ep.risk_score > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${ep.risk_score || 0}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{ep.risk_score || 0}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${(ep.patch_score || 0) >= 80 ? 'text-emerald-400' : (ep.patch_score || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                          {ep.patch_score || 0}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${(ep.compliance_score || 0) >= 80 ? 'text-emerald-400' : (ep.compliance_score || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                          {ep.compliance_score || 0}%
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-xs whitespace-nowrap">
                        {ep.last_checkin ? new Date(ep.last_checkin).toLocaleString('pt-BR') : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-slate-400 border-t border-slate-700/50">{total} endpoints encontrados</div>
        </div>
      </div>
    </Layout>
  );
}
