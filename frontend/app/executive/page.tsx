'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { executiveAiApi } from '@/services/api';
import Layout from '@/components/Layout';
import {
  Gauge, FileText, RefreshCw, Download, Loader2,
  TrendingUp, ShieldCheck, AlertTriangle, Activity,
  CheckCircle2, XCircle, Server, Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const REPORT_TYPES = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'executive', label: 'Executivo' },
];

function ScoreCard({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = (score / max) * 100;
  const colorMap: Record<string, string> = { monitoring: '#3b82f6', incidents: '#ef4444', security: '#f59e0b', compliance: '#10b981', endpoints: '#8b5cf6' };
  const c = colorMap[label.toLowerCase()] || '#6366f1';
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-xs text-slate-400 capitalize mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-slate-500 text-sm mb-0.5">/{max}</span>
      </div>
      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }} />
      </div>
    </div>
  );
}

export default function ExecutivePage() {
  const [reportType, setReportType] = useState('weekly');
  const [report, setReport] = useState<any>(null);

  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['ai-health-score'],
    queryFn: executiveAiApi.getHealthScore,
    refetchInterval: 120000,
  });

  const genReport = useMutation({
    mutationFn: () => executiveAiApi.generateReport({ report_type: reportType }),
    onSuccess: (data) => setReport(data),
  });

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.report], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-ti-${reportType}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
  };

  const hs = health;

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Gauge className="w-6 h-6 text-violet-400" /> Executive AI
            </h1>
            <p className="text-slate-400 text-sm mt-1">Visão executiva da saúde de TI, relatórios inteligentes e KPIs</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm border border-slate-700">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        ) : hs ? (
          <>
            {/* Main Health Score */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex flex-col items-center">
                  <div className={`text-7xl font-black ${scoreColor(hs.score)}`}>{hs.score}</div>
                  <div className="text-slate-400 text-sm mt-1">/ 100</div>
                  <div className={`text-xs font-semibold uppercase tracking-widest mt-2 ${scoreColor(hs.score)}`}>{hs.status}</div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {hs.breakdown && Object.entries(hs.breakdown).map(([key, val]: [string, any]) => (
                    <ScoreCard key={key} label={key} score={val.score} max={val.max} color={hs.color} />
                  ))}
                </div>
              </div>

              {/* Breakdown detail */}
              {hs.breakdown && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-2">
                  {Object.entries(hs.breakdown).map(([key, val]: [string, any]) => (
                    <div key={key} className="text-xs text-center text-slate-500">{val.detail}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Disponibilidade', value: `${hs.breakdown?.monitoring?.score ?? 0}/25`, icon: Activity, color: 'bg-blue-600' },
                { label: 'Incidentes', value: `${hs.breakdown?.incidents?.score ?? 0}/25`, icon: AlertTriangle, color: 'bg-red-600' },
                { label: 'Segurança', value: `${hs.breakdown?.security?.score ?? 0}/20`, icon: ShieldCheck, color: 'bg-amber-600' },
                { label: 'Compliance', value: `${hs.breakdown?.compliance?.score ?? 0}/15`, icon: CheckCircle2, color: 'bg-emerald-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-lg font-bold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Report Generator */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                Gerador de Relatórios Inteligentes
              </h3>
              <div className="flex gap-3 flex-wrap items-center">
                <div className="flex gap-2">
                  {REPORT_TYPES.map(rt => (
                    <button
                      key={rt.value}
                      onClick={() => setReportType(rt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${reportType === rt.value ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => genReport.mutate()}
                  disabled={genReport.isPending}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm ml-auto"
                >
                  {genReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Gerar Relatório
                </button>
                {report && (
                  <button onClick={downloadReport} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm border border-slate-700">
                    <Download className="w-4 h-4" /> Download .md
                  </button>
                )}
              </div>

              {report && (
                <div className="mt-5 bg-slate-950 rounded-xl p-5 border border-slate-800 max-h-[500px] overflow-y-auto">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs text-slate-400">Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')} · {report.tokens} tokens · {report.model}</p>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{report.report}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
