'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { monitoringApi } from '@/services/api';
import { Activity, TrendingUp, Server, ChevronDown } from 'lucide-react';

function Sparkline({ data, color = '#6366f1', height = 60 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const W = 300, H = height, PAD = 4;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color.replace('#', '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />}
    </svg>
  );
}

const METRIC_COLORS: Record<string, string> = {
  cpu_percent:  '#6366f1',
  mem_percent:  '#8b5cf6',
  disk_percent: '#f59e0b',
  ping_ms:      '#10b981',
};
const METRIC_LABELS: Record<string, string> = {
  cpu_percent:  'CPU %',
  mem_percent:  'Memória %',
  disk_percent: 'Disco %',
  ping_ms:      'Ping (ms)',
};

export default function MetricsPage() {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [hours, setHours] = useState(24);

  const { data: targets } = useQuery({
    queryKey: ['monitoring-targets-list'],
    queryFn: () => monitoringApi.listTargets({ per_page: 100 }).then(r => r.data),
  });

  const targetList = targets?.items ?? [];
  const activeTarget = selectedTarget ?? targetList[0]?.id ?? null;

  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['target-metrics', activeTarget, hours],
    queryFn: () => activeTarget ? monitoringApi.getMetrics(activeTarget, { hours }).then(r => r.data) : null,
    enabled: !!activeTarget,
    refetchInterval: 60_000,
  });

  const metrics = metricsData?.metrics ?? {};
  const metricKeys = Object.keys(metrics);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Visualizador de Métricas</h1>
          <p className="text-muted-foreground text-sm mt-1">Dados de performance em série temporal para dispositivos monitorados</p>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 min-w-[240px]">
            <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <select value={activeTarget ?? ''} onChange={e => setSelectedTarget(Number(e.target.value))}
              className="bg-transparent text-sm flex-1 outline-none">
              <option value="">Selecionar alvo…</option>
              {targetList.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.host})</option>)}
            </select>
          </div>
          <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
            {[6, 12, 24, 48, 168].map(h => (
              <button key={h} onClick={() => setHours(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${hours === h ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {h < 24 ? `${h}h` : h === 24 ? '24h' : h === 48 ? '2d' : '7d'}
              </button>
            ))}
          </div>
        </div>

        {!activeTarget ? (
          <div className="py-20 text-center bg-card border border-border rounded-xl">
            <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Selecione um alvo para ver as métricas</p>
          </div>
        ) : isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : metricKeys.length === 0 ? (
          <div className="py-20 text-center bg-card border border-border rounded-xl">
            <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma métrica coletada ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Sonde o alvo na página de Monitoramento para coletar dados</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {metricKeys.map(mKey => {
              const samples: { value: number; ts: string }[] = metrics[mKey] ?? [];
              const values = samples.map(s => s.value);
              const last = values[values.length - 1];
              const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              const max = values.length ? Math.max(...values) : 0;
              const color = METRIC_COLORS[mKey] ?? '#6366f1';
              const label = METRIC_LABELS[mKey] ?? mKey;
              return (
                <div key={mKey} className="bg-card border border-border rounded-xl p-5 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{label}</h3>
                      <p className="text-xs text-muted-foreground">{samples.length} amostras · janela de {hours}h</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold" style={{ color }}>{last != null ? last.toFixed(1) : '—'}</p>
                      <p className="text-xs text-muted-foreground">atual</p>
                    </div>
                  </div>
                  <div className="h-16 mb-3">
                    <Sparkline data={values} color={color} height={64} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[['Média', avg.toFixed(1)], ['Máx', max.toFixed(1)], ['Mín', (values.length ? Math.min(...values) : 0).toFixed(1)]].map(([k, v]) => (
                      <div key={k} className="bg-muted/30 rounded-lg py-1.5">
                        <p className="text-[10px] text-muted-foreground">{k}</p>
                        <p className="text-xs font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
