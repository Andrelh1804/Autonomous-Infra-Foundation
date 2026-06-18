'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { ocsApi } from '@/services/api';
import {
  FileText, AlertCircle, Info, AlertTriangle, ChevronRight,
  RefreshCw, Loader2, Filter, Database,
} from 'lucide-react';
import Link from 'next/link';

type Log = {
  id: number;
  integration_id: number;
  job_id: number | null;
  level: string;
  category: string;
  message: string;
  details: string | null;
  created_at: string;
};

type Job = {
  id: number;
  sync_type: string;
  status: string;
  assets_created: number;
  assets_updated: number;
  software_imported: number;
  users_imported: number;
  changes_detected: number;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
};

function levelIcon(level: string) {
  if (level === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (level === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'failed') return 'text-red-400';
  if (status === 'running') return 'text-amber-400';
  return 'text-muted-foreground';
}

function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR');
}

export default function OcsLogsPage() {
  const params = useSearchParams();
  const integId = Number(params.get('id') ?? 0);
  const [tab, setTab] = useState<'logs' | 'jobs'>('logs');
  const [levelFilter, setLevelFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<Log[]>({
    queryKey: ['ocs-logs', integId, levelFilter, page],
    queryFn: () => ocsApi.logs(integId, { page, per_page: 100, level: levelFilter || undefined }).then(r => r.data),
    enabled: !!integId,
  });

  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useQuery<Job[]>({
    queryKey: ['ocs-jobs', integId, page],
    queryFn: () => ocsApi.jobs(integId, { page, per_page: 20 }).then(r => r.data),
    enabled: !!integId,
  });

  if (!integId) {
    return (
      <Layout>
        <div className="text-center py-16">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma integração selecionada.</p>
          <Link href="/integrations/ocs" className="text-sm text-indigo-400 hover:underline mt-2 block">← Voltar para Integrações OCS</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/integrations" className="hover:text-foreground transition">Integrações</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/integrations/ocs" className="hover:text-foreground transition">OCS Inventory NG</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Logs</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Logs OCS — Integração #{integId}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
          {(['logs', 'jobs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition capitalize ${tab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'logs' ? 'Logs de Sincronização' : 'Histórico de Jobs'}
            </button>
          ))}
        </div>

        {tab === 'logs' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm">Logs de Sincronização</span>
              <div className="flex items-center gap-2 ml-auto">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={levelFilter}
                  onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
                  className="text-xs bg-background border border-border rounded-lg px-2 py-1.5"
                >
                  <option value="">Todos os níveis</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
                <button onClick={() => refetchLogs()} className="p-1.5 rounded-lg border border-border hover:bg-accent transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 font-mono text-xs max-h-[600px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition ${log.level === 'error' ? 'bg-red-500/5' : ''}`}>
                    {levelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`font-medium uppercase tracking-wide text-[10px] ${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{log.level}</span>
                        <span className="text-muted-foreground/60">[{log.category}]</span>
                        {log.job_id && <span className="text-muted-foreground/60">job#{log.job_id}</span>}
                      </div>
                      <p className="text-foreground/90 break-words">{log.message}</p>
                      {log.details && <p className="text-muted-foreground/70 mt-0.5 break-words">{log.details}</p>}
                    </div>
                    <span className="text-muted-foreground/50 whitespace-nowrap">{fmt(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{logs.length} registros</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-accent transition">Anterior</button>
                <span className="px-3 py-1">Pág. {page}</span>
                <button disabled={logs.length < 100} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-accent transition">Próxima</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'jobs' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">Histórico de Jobs</span>
              <button onClick={() => refetchJobs()} className="p-1.5 rounded-lg border border-border hover:bg-accent transition">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {jobsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center">
                <Database className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum job executado ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {jobs.map(job => (
                  <div key={job.id} className="px-5 py-4 hover:bg-muted/20 transition">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Job #{job.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize
                          border-slate-500/20 bg-slate-500/10 text-slate-400">{job.sync_type}</span>
                        <span className={`text-xs font-medium ${statusColor(job.status)}`}>{job.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{fmt(job.started_at)}</span>
                    </div>
                    {job.error_message && (
                      <p className="text-xs text-red-400 mb-2">{job.error_message}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>+{job.assets_created} criados</span>
                      <span>~{job.assets_updated} atualizados</span>
                      <span>{job.software_imported} sw</span>
                      <span>{job.users_imported} users</span>
                      <span>{job.changes_detected} mudanças</span>
                      {job.duration_seconds && <span>{job.duration_seconds.toFixed(1)}s</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 text-xs">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-accent transition">Anterior</button>
              <span className="text-muted-foreground">Pág. {page}</span>
              <button disabled={jobs.length < 20} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-accent transition">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
