'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiOpsApi } from '@/services/api';
import Layout from '@/components/Layout';
import {
  BrainCircuit, RefreshCw, AlertTriangle, CheckCircle2,
  Lightbulb, Zap, TrendingUp, Server, ShieldAlert,
  Clock, ChevronRight, Loader2, Target,
} from 'lucide-react';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

function HealthGauge({ score, status, color }: { score: number; status: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: '#10b981', green: '#22c55e', amber: '#f59e0b', orange: '#f97316', red: '#ef4444',
  };
  const c = colorMap[color] || '#6366f1';
  const r = 56, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={12} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={12}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={22} fontWeight="bold">{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={11}>/100</text>
      </svg>
      <span className="text-xs font-semibold uppercase tracking-wide mt-1" style={{ color: c }}>{status}</span>
    </div>
  );
}

export default function AIOpsPage() {
  const qc = useQueryClient();
  const [rcaOpen, setRcaOpen] = useState(false);
  const [rcaDesc, setRcaDesc] = useState('');
  const [rcaResult, setRcaResult] = useState<any>(null);

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['ai-ops-dashboard'],
    queryFn: aiOpsApi.getDashboard,
    refetchInterval: 60000,
  });

  const generateInsights = useMutation({
    mutationFn: aiOpsApi.generateInsights,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-ops-dashboard'] }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => aiOpsApi.markInsightRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-ops-dashboard'] }),
  });

  const updateRec = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      aiOpsApi.updateRecommendation(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-ops-dashboard'] }),
  });

  const runRca = async () => {
    const res = await aiOpsApi.rootCauseAnalysis({ description: rcaDesc });
    setRcaResult(res.rca);
  };

  const hs = dashboard?.health_score;
  const insights = dashboard?.insights || [];
  const recs = dashboard?.recommendations || [];
  const platform = dashboard?.platform || {};

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-violet-400" />
              AI Operations Center
            </h1>
            <p className="text-slate-400 text-sm mt-1">Visão inteligente em tempo real da infraestrutura de TI</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm">
              {generateInsights.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              Gerar Insights
            </button>
            <button onClick={() => refetch()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm border border-slate-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : (
          <>
            {/* Health + Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center">
                {hs && <HealthGauge score={hs.score} status={hs.status} color={hs.color} />}
                <p className="text-xs text-slate-500 mt-2">Health Score Global</p>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Monitoramento</p>
                  <p className="text-xl font-bold text-white">{platform.monitoring?.availability_pct ?? '—'}%</p>
                  <p className="text-xs text-slate-500">{platform.monitoring?.up}/{platform.monitoring?.total_targets} targets up</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Tickets Críticos</p>
                  <p className="text-xl font-bold text-white">{platform.critical_tickets?.count ?? 0}</p>
                  <p className="text-xs text-slate-500">incidentes abertos</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Alertas (24h)</p>
                  <p className="text-xl font-bold text-white">{platform.recent_alerts?.count ?? 0}</p>
                  <p className="text-xs text-slate-500">eventos detectados</p>
                </div>
              </div>
            </div>

            {/* Health Breakdown */}
            {hs?.breakdown && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-4">Detalhamento do Health Score</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(hs.breakdown).map(([key, val]: [string, any]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span className="capitalize">{key}</span>
                        <span className="text-white">{val.score}/{val.max}</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(val.score / val.max) * 100}%` }} />
                      </div>
                      <p className="text-xs text-slate-600">{val.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights + Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Insights */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  AI Insights
                  {insights.length > 0 && <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 rounded-full px-2 py-0.5">{insights.length}</span>}
                </h3>
                <div className="space-y-3">
                  {insights.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">Nenhum insight. Clique em "Gerar Insights" para analisar.</p>
                  )}
                  {insights.map((ins: any) => (
                    <div key={ins.id} className={`flex gap-3 rounded-lg p-3 border ${SEVERITY_COLOR[ins.severity] || SEVERITY_COLOR.medium}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[ins.severity] || 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ins.title}</p>
                        <p className="text-xs opacity-75 mt-0.5 line-clamp-2">{ins.description}</p>
                      </div>
                      <button onClick={() => markRead.mutate(ins.id)} className="text-xs opacity-50 hover:opacity-100 shrink-0">✓</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Recomendações
                </h3>
                <div className="space-y-3">
                  {recs.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhuma recomendação aberta.</p>}
                  {recs.map((r: any) => (
                    <div key={r.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-start gap-2">
                        <span className={`text-xs rounded px-1.5 py-0.5 shrink-0 ${SEVERITY_COLOR[r.priority] || ''}`}>{r.priority}</span>
                        <p className="text-sm text-white flex-1">{r.title}</p>
                      </div>
                      {r.action && <p className="text-xs text-slate-400 mt-1.5">{r.action}</p>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => updateRec.mutate({ id: r.id, status: 'accepted' })} className="text-xs text-emerald-400 hover:text-emerald-300">Aceitar</button>
                        <button onClick={() => updateRec.mutate({ id: r.id, status: 'dismissed' })} className="text-xs text-slate-500 hover:text-slate-300">Ignorar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RCA Tool */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Root Cause Analysis Assistida por IA
              </h3>
              <div className="flex gap-3">
                <textarea
                  value={rcaDesc}
                  onChange={e => setRcaDesc(e.target.value)}
                  placeholder="Descreva o incidente ou problema para análise de causa raiz..."
                  rows={2}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-violet-500 resize-none"
                />
                <button onClick={runRca} disabled={!rcaDesc.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4" /> Analisar
                </button>
              </div>
              {rcaResult && (
                <div className="mt-4 space-y-3">
                  {rcaResult.possible_causes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Possíveis Causas</p>
                      <div className="space-y-2">
                        {rcaResult.possible_causes.map((c: any, i: number) => (
                          <div key={i} className="flex gap-3 bg-slate-800 rounded-lg p-3">
                            <span className="text-xs bg-violet-700/40 text-violet-300 rounded px-1.5 py-0.5 shrink-0">{c.probability}%</span>
                            <div>
                              <p className="text-sm text-white">{c.cause}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{c.justification}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rcaResult.recommended_steps && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Próximas Ações</p>
                      <ol className="space-y-1">
                        {rcaResult.recommended_steps.map((s: string, i: number) => (
                          <li key={i} className="text-sm text-slate-300 flex gap-2">
                            <span className="text-violet-400 shrink-0">{i + 1}.</span>{s}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {rcaResult.raw_analysis && <p className="text-sm text-slate-300 whitespace-pre-wrap">{rcaResult.raw_analysis}</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
