'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Monitor, Wifi, WifiOff, Server, Apple, Terminal, RefreshCw, Download, Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  online: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  offline: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  unknown: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  windows: Monitor, linux: Terminal, macos: Apple,
};

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '–'}</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export default function AgentCenterPage() {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [agentStatus, setAgentStatus] = useState('');

  const { data: stats } = useQuery({ queryKey: ['agent-stats'], queryFn: agentsApi.getStats, refetchInterval: 30000 });
  const { data: agents = [], isLoading, refetch } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 30000 });

  const filtered = (agents as any[]).filter((a: any) => {
    if (search && !a.hostname?.toLowerCase().includes(search.toLowerCase()) && !a.ip_address?.includes(search)) return false;
    if (platform && a.platform !== platform) return false;
    if (agentStatus && a.agent_status !== agentStatus) return false;
    return true;
  });

  const s = stats as any;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Central de Agentes</h1>
            <p className="text-slate-400 mt-1">Gerencie agentes instalados nos endpoints</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> Baixar Agente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total" value={s?.total} icon={Server} color="bg-indigo-500/10 text-indigo-400" />
          <StatCard label="Online" value={s?.online} icon={Wifi} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard label="Offline" value={s?.offline} icon={WifiOff} color="bg-slate-500/10 text-slate-400" />
          <StatCard label="Windows" value={s?.windows} icon={Monitor} color="bg-blue-500/10 text-blue-400" />
          <StatCard label="Linux" value={s?.linux} icon={Terminal} color="bg-orange-500/10 text-orange-400" />
          <StatCard label="macOS" value={s?.macos} icon={Apple} color="bg-purple-500/10 text-purple-400" />
        </div>

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
                <th className="text-left p-4">Versão</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Risco</th>
                <th className="text-left p-4">Compliance</th>
                <th className="text-left p-4">Último Checkin</th>
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum agente encontrado</td></tr>
                ) : filtered.map((a: any) => {
                  const PIcon = PLATFORM_ICONS[a.platform] || Monitor;
                  return (
                    <tr key={a.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <PIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-white font-medium">{a.hostname}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{a.ip_address || '–'}</td>
                      <td className="p-4 text-slate-300">{a.os_name || '–'}</td>
                      <td className="p-4 text-slate-300">{a.agent_version || '–'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${STATUS_COLORS[a.agent_status] || STATUS_COLORS.unknown}`}>
                          {a.agent_status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${a.risk_score > 70 ? 'bg-red-500' : a.risk_score > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${a.risk_score}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{a.risk_score}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${a.compliance_score >= 80 ? 'text-emerald-400' : a.compliance_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{a.compliance_score}%</span>
                      </td>
                      <td className="p-4 text-slate-400 text-xs">{a.last_checkin ? new Date(a.last_checkin).toLocaleString('pt-BR') : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Instalação do Agente</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-blue-400 font-semibold mb-2 flex items-center gap-1"><Monitor className="w-3 h-3" /> Windows (PowerShell)</p>
              <code className="text-slate-300 block">python aii_agent.py --enroll --server https://seu-servidor --org-token TOKEN</code>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-orange-400 font-semibold mb-2 flex items-center gap-1"><Terminal className="w-3 h-3" /> Linux (Bash)</p>
              <code className="text-slate-300 block">python3 aii_agent.py --enroll --server https://seu-servidor --org-token TOKEN</code>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-purple-400 font-semibold mb-2 flex items-center gap-1"><Apple className="w-3 h-3" /> macOS</p>
              <code className="text-slate-300 block">python3 aii_agent.py --enroll --server https://seu-servidor --org-token TOKEN</code>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
