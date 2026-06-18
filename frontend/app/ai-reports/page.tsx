'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { executiveAiApi, aiCopilotApi } from '@/services/api';
import Layout from '@/components/Layout';
import {
  BarChart3, FileText, Download, Loader2, Zap, Clock,
  TrendingUp, CheckCircle2, AlertTriangle, FileCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const REPORT_TYPES = [
  { value: 'daily', label: 'Resumo Diário', icon: Clock, desc: 'Operações do dia, alertas e incidentes' },
  { value: 'weekly', label: 'Relatório Semanal', icon: TrendingUp, desc: 'KPIs, incidentes, vulnerabilidades e recomendações' },
  { value: 'monthly', label: 'Relatório Mensal', icon: BarChart3, desc: 'Análise completa com tendências e otimizações' },
  { value: 'executive', label: 'Sumário Executivo', icon: FileCheck, desc: 'Visão de negócios, riscos e decisões necessárias' },
];

export default function AIReportsPage() {
  const [selectedType, setSelectedType] = useState('weekly');
  const [report, setReport] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(false);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['ai-audit'],
    queryFn: () => aiCopilotApi.getAuditLog(100),
    enabled: auditPage,
  });

  const genReport = useMutation({
    mutationFn: () => executiveAiApi.generateReport({ report_type: selectedType }),
    onSuccess: (data) => setReport(data),
  });

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.report], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${selectedType}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
  };

  const { data: stats } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: aiCopilotApi.getStats,
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-violet-400" /> AI Reports
          </h1>
          <p className="text-slate-400 text-sm mt-1">Relatórios inteligentes gerados automaticamente pela IA</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Conversas', value: stats.conversations, icon: FileText, color: 'bg-violet-600' },
              { label: 'Mensagens', value: stats.messages, icon: CheckCircle2, color: 'bg-blue-600' },
              { label: 'Tokens Usados', value: (stats.total_tokens || 0).toLocaleString('pt-BR'), icon: Zap, color: 'bg-amber-600' },
              { label: 'Provedor', value: stats.provider, icon: TrendingUp, color: stats.is_configured ? 'bg-emerald-600' : 'bg-slate-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-base font-bold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Report Type Selection */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Selecione o Tipo de Relatório</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {REPORT_TYPES.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                onClick={() => setSelectedType(value)}
                className={`text-left rounded-xl p-4 border transition-colors ${selectedType === value ? 'bg-violet-700/20 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:border-slate-600'}`}
              >
                <Icon className={`w-5 h-5 mb-2 ${selectedType === value ? 'text-violet-400' : 'text-slate-400'}`} />
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500 mt-1">{desc}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => genReport.mutate()}
              disabled={genReport.isPending}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              {genReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Gerar Relatório com IA
            </button>
            {report && (
              <button onClick={downloadReport}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-4 py-2.5 text-sm border border-slate-700">
                <Download className="w-4 h-4" /> Download
              </button>
            )}
          </div>
        </div>

        {/* Report output */}
        {report && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                {REPORT_TYPES.find(r => r.value === report.type)?.label}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Health Score: <span className="text-white font-semibold">{report.health_score}/100</span></span>
                <span>{report.tokens} tokens</span>
                <span>{report.model}</span>
                <span>{new Date(report.generated_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 max-h-[600px] overflow-y-auto">
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{report.report}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log toggle */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-400" /> Audit Log de IA
            </h3>
            <button onClick={() => setAuditPage(!auditPage)} className="text-xs text-violet-400 hover:text-violet-300">
              {auditPage ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {auditPage && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th className="text-left pb-2 pr-4">Ação</th>
                    <th className="text-left pb-2 pr-4">Modelo</th>
                    <th className="text-right pb-2 pr-4">Tokens</th>
                    <th className="text-right pb-2 pr-4">Latência</th>
                    <th className="text-left pb-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map((l: any) => (
                    <tr key={l.id} className="hover:bg-slate-800/50">
                      <td className="py-2 pr-4 text-slate-300 capitalize">{l.action}</td>
                      <td className="py-2 pr-4 text-slate-400">{l.model || '—'}</td>
                      <td className="py-2 pr-4 text-slate-400 text-right">{(l.total_tokens || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-400 text-right">{l.latency_ms ? `${l.latency_ms}ms` : '—'}</td>
                      <td className="py-2 text-slate-500 text-xs">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Nenhum registro de auditoria</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
