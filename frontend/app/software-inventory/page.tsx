'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { softwareApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Package, Search, BarChart3 } from 'lucide-react';

export default function SoftwareInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isSystem, setIsSystem] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['software', search, page, isSystem],
    queryFn: () => softwareApi.list({ search, page, per_page: 100, is_system: isSystem === '' ? undefined : isSystem === 'true' }),
  });
  const { data: summary } = useQuery({ queryKey: ['software-summary'], queryFn: softwareApi.summary });

  const items = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  const s = summary as any;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventário de Software</h1>
            <p className="text-slate-400 mt-1">Softwares instalados em todos os endpoints</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total de Instalações', value: s?.total_installations, icon: Package, color: 'bg-indigo-500/10 text-indigo-400' },
            { label: 'Aplicativos Únicos', value: s?.unique_applications, icon: BarChart3, color: 'bg-emerald-500/10 text-emerald-400' },
            { label: 'Resultados Filtrados', value: total, icon: Search, color: 'bg-amber-500/10 text-amber-400' },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}><c.icon className="w-6 h-6" /></div>
              <div><p className="text-2xl font-bold text-white">{c.value ?? '–'}</p><p className="text-sm text-slate-400">{c.label}</p></div>
            </div>
          ))}
        </div>

        {s?.top_applications?.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Top 10 Mais Instalados</h3>
            <div className="space-y-2">
              {s.top_applications.slice(0, 10).map((app: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white truncate">{app.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{app.install_count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(app.install_count / s.top_applications[0].install_count) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl">
          <div className="p-4 border-b border-slate-700/50 flex flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou fabricante..." className="flex-1 min-w-48 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
            <select value={isSystem} onChange={e => setIsSystem(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Todos tipos</option>
              <option value="false">Aplicativos</option>
              <option value="true">Sistema</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-left p-4">Nome</th>
                <th className="text-left p-4">Fabricante</th>
                <th className="text-left p-4">Versão</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-left p-4">Data Inst.</th>
              </tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum software encontrado</td></tr> :
                    items.map((sw: any) => (
                      <tr key={sw.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-4 text-white font-medium">{sw.name}</td>
                        <td className="p-4 text-slate-300">{sw.publisher || '–'}</td>
                        <td className="p-4 text-slate-300">{sw.version || '–'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${sw.is_system ? 'bg-slate-500/20 text-slate-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                            {sw.is_system ? 'Sistema' : 'Aplicativo'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{sw.install_date || '–'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-slate-400 border-t border-slate-700/50">{total} registros encontrados</div>
        </div>
      </div>
    </Layout>
  );
}
