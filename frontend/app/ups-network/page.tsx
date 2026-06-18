'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { monitoringApi } from '@/services/api';
import { Zap, Router, Wifi, Activity, RefreshCw, WifiOff, Clock, Server } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  ups: Zap, switch: Router, router: Router, ap: Wifi, firewall: Server,
};
const TYPE_COLORS: Record<string, string> = {
  ups: 'bg-amber-600', switch: 'bg-indigo-600', router: 'bg-violet-600', ap: 'bg-cyan-600', firewall: 'bg-rose-600',
};
const TYPE_LABELS: Record<string, string> = {
  ups: 'Nobreaks (UPS)', switch: 'Switches', router: 'Roteadores', ap: 'Access Points', firewall: 'Firewalls',
};

function relTime(iso: string | null) {
  if (!iso) return 'Nunca';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  return `há ${Math.floor(m / 60)}h`;
}

function HealthRing({ score }: { score: number }) {
  const r = 20, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{Math.round(score)}</text>
    </svg>
  );
}

export default function UpsNetworkPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['ups-network-targets'],
    queryFn: () => monitoringApi.listTargets({ device_type: '', per_page: 200 }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const pollMut = useMutation({
    mutationFn: (id: number) => monitoringApi.pollTarget(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ups-network-targets'] }),
  });

  const allTargets = (data?.items ?? []).filter((t: any) =>
    ['ups', 'switch', 'router', 'ap', 'firewall'].includes(t.device_type)
  );

  const byType: Record<string, any[]> = {};
  for (const t of allTargets) {
    (byType[t.device_type] = byType[t.device_type] ?? []).push(t);
  }

  const typeOrder = ['ups', 'switch', 'router', 'ap', 'firewall'];
  const orderedTypes = typeOrder.filter(t => byType[t]?.length);

  const online  = allTargets.filter((t: any) => t.is_online).length;
  const offline = allTargets.filter((t: any) => t.is_online === false).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">UPS e Dispositivos de Rede</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistemas de energia, switches, roteadores e access points</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total de Dispositivos', val: allTargets.length, icon: Activity, color: 'bg-indigo-600' },
            { label: 'Online',                val: online,            icon: Wifi,     color: 'bg-emerald-600' },
            { label: 'Offline',               val: offline,           icon: WifiOff,  color: 'bg-red-600' },
            { label: 'Tipos de Dispositivo',  val: orderedTypes.length, icon: Router, color: 'bg-violet-600' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{val}</p></div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : allTargets.length === 0 ? (
          <div className="py-20 text-center bg-card border border-border rounded-xl">
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum UPS ou dispositivo de rede monitorado</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione alvos do tipo ups, switch, router, ap ou firewall</p>
          </div>
        ) : (
          orderedTypes.map(type => {
            const Icon = TYPE_ICONS[type] ?? Activity;
            const color = TYPE_COLORS[type] ?? 'bg-indigo-600';
            const items = byType[type];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="font-semibold text-sm">{TYPE_LABELS[type] || type}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((t: any) => (
                    <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <HealthRing score={t.health_score ?? 100} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.host}</p>
                          {t.vendor && <p className="text-xs text-muted-foreground">{t.vendor}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {t.is_online === true  && <Wifi  className="w-3.5 h-3.5 text-emerald-400" />}
                          {t.is_online === false && <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                          {t.is_online === null  && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Última: {relTime(t.last_polled_at)}</span>
                        <button onClick={() => pollMut.mutate(t.id)}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition">
                          <RefreshCw className={`w-3 h-3 ${pollMut.isPending ? 'animate-spin' : ''}`} /> Sondar
                        </button>
                      </div>
                      {t.last_error && (
                        <p className="mt-1 text-[10px] text-red-400 truncate">{t.last_error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
