'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiOpsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Lightbulb, RefreshCw, Loader2, Check, Filter } from 'lucide-react';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const TYPE_ICON: Record<string, string> = {
  anomaly: '⚡',
  trend: '📈',
  risk: '🔴',
  optimization: '✨',
};

export default function AIInsightsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [showRead, setShowRead] = useState(false);

  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-insights', filter, showRead],
    queryFn: () => aiOpsApi.listInsights({ severity: filter === 'all' ? undefined : filter, is_read: showRead ? undefined : false }),
    refetchInterval: 60000,
  });

  const generateInsights = useMutation({
    mutationFn: aiOpsApi.generateInsights,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-insights'] }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => aiOpsApi.markInsightRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-insights'] }),
  });

  const unread = insights.filter((i: any) => !i.is_read).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-400" />
              AI Insights
              {unread > 0 && <span className="text-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">{unread} novos</span>}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Insights gerados automaticamente pela IA sobre sua infraestrutura</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm">
              {generateInsights.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              Gerar Insights
            </button>
            <button onClick={() => refetch()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm border border-slate-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-4 h-4 text-slate-400" />
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors capitalize ${filter === s ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer ml-auto">
            <input type="checkbox" checked={showRead} onChange={e => setShowRead(e.target.checked)} className="rounded" />
            Mostrar lidos
          </label>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Lightbulb className="w-12 h-12 mb-3 opacity-30" />
            <p>Nenhum insight encontrado.</p>
            <p className="text-sm mt-1">Clique em "Gerar Insights" para analisar a infraestrutura.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((ins: any) => (
              <div key={ins.id} className={`bg-slate-900 border rounded-xl p-5 flex gap-4 transition-opacity ${ins.is_read ? 'opacity-50' : ''}`}
                style={{ borderColor: ins.severity === 'critical' ? 'rgb(239 68 68 / 0.3)' : ins.severity === 'high' ? 'rgb(249 115 22 / 0.3)' : 'rgb(51 65 85)' }}>
                <div className="text-2xl shrink-0">{TYPE_ICON[ins.type] || '💡'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="text-white font-semibold flex-1">{ins.title}</h3>
                    <span className={`text-xs rounded-full px-2 py-0.5 border capitalize ${SEVERITY_BADGE[ins.severity] || SEVERITY_BADGE.medium}`}>{ins.severity}</span>
                    <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2 py-0.5 capitalize">{ins.type}</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1.5">{ins.description}</p>
                  <p className="text-xs text-slate-600 mt-2">{new Date(ins.created_at).toLocaleString('pt-BR')}</p>
                </div>
                {!ins.is_read && (
                  <button onClick={() => markRead.mutate(ins.id)}
                    className="shrink-0 w-7 h-7 rounded-full bg-slate-800 hover:bg-emerald-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
