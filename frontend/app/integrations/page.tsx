'use client';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Database, Plus, Plug } from 'lucide-react';

const INTEGRATIONS = [
  {
    id: 'ocs',
    name: 'OCS Inventory NG',
    description: 'Importação de hardware, software, usuários e redes do OCS Inventory NG',
    href: '/integrations/ocs',
    icon: Database,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'ITAM / CMDB',
  },
];

export default function IntegrationsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="w-6 h-6 text-indigo-400" />
            Integrações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conectores com sistemas externos de inventário, monitoramento e gestão de ativos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integ) => {
            const Icon = integ.icon;
            return (
              <Link
                key={integ.id}
                href={integ.href}
                className={`block rounded-xl border ${integ.border} ${integ.bg} p-5 hover:opacity-90 transition group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${integ.bg} border ${integ.border} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${integ.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{integ.name}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {integ.badge}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {integ.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-xs text-indigo-400 font-medium group-hover:underline">
                  Configurar →
                </div>
              </Link>
            );
          })}

          {/* Placeholder — coming soon */}
          <div className="rounded-xl border border-border border-dashed p-5 flex items-center justify-center text-center">
            <div>
              <Plus className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Mais integrações em breve</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Zabbix, GLPI, Snipe-IT, Jira…</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
