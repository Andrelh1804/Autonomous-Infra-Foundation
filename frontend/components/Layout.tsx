'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useThemeStore } from '@/store/auth';
import { authApi, alertsApi } from '@/services/api';
import { cn, formatDate } from '@/lib/utils';
import {
  LayoutDashboard, Building2, Users, MapPin, ShieldCheck,
  Settings, LogOut, Bell, Sun, Moon, ChevronLeft, ChevronRight, Menu, ScrollText,
  Radar, Server, Network, GitFork, History, ChevronDown,
  XCircle, Mail, Webhook, Zap, CheckCircle2, AlertTriangle,
  Activity, TrendingUp, Printer, MonitorCheck, FileBarChart2,
  Bot, Monitor, Package, Key, ShieldAlert, Terminal, Shield, Cpu, Briefcase, FileText,
  Ticket, AlertOctagon, GitMerge, BookOpen, Clock, Workflow, Cog,
} from 'lucide-react';
import type { AlertEvent } from '@/types';

const NAV_GROUPS = [
  {
    label: 'Plataforma',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/organizations', icon: Building2, label: 'Organizações' },
      { href: '/users', icon: Users, label: 'Usuários' },
      { href: '/sites', icon: MapPin, label: 'Sites' },
    ],
  },
  {
    label: 'Discovery & CMDB',
    items: [
      { href: '/discovery', icon: Radar, label: 'Discovery' },
      { href: '/assets', icon: Server, label: 'Ativos / CMDB' },
      { href: '/network-map', icon: Network, label: 'Mapa de Rede' },
      { href: '/relationships', icon: GitFork, label: 'Relacionamentos' },
      { href: '/asset-history', icon: History, label: 'Histórico de Ativos' },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      { href: '/noc', icon: MonitorCheck, label: 'Centro NOC' },
      { href: '/monitoring', icon: Activity, label: 'Alvos de Monitoramento' },
      { href: '/metrics', icon: TrendingUp, label: 'Visualizador de Métricas' },
      { href: '/events', icon: AlertTriangle, label: 'Eventos & Incidentes' },
      { href: '/printers', icon: Printer, label: 'Impressoras' },
      { href: '/ups-network', icon: Zap, label: 'UPS & Rede' },
      { href: '/reports', icon: FileBarChart2, label: 'Relatórios' },
    ],
  },
  {
    label: 'Endpoint Management',
    items: [
      { href: '/agent-center', icon: Bot, label: 'Central de Agentes' },
      { href: '/endpoints', icon: Monitor, label: 'Endpoints' },
      { href: '/software-inventory', icon: Package, label: 'Inventário de Software' },
      { href: '/licenses', icon: Key, label: 'Licenciamento' },
      { href: '/vulnerabilities', icon: ShieldAlert, label: 'Vulnerabilidades' },
      { href: '/patches', icon: Shield, label: 'Patches' },
      { href: '/compliance', icon: CheckCircle2, label: 'Compliance' },
      { href: '/remote-actions', icon: Terminal, label: 'Ações Remotas' },
      { href: '/jobs', icon: Cpu, label: 'Jobs' },
      { href: '/policies', icon: FileText, label: 'Políticas' },
    ],
  },
  {
    label: 'ITSM',
    items: [
      { href: '/tickets', icon: Ticket, label: 'Tickets' },
      { href: '/problems', icon: AlertOctagon, label: 'Problemas' },
      { href: '/changes', icon: GitMerge, label: 'Mudanças' },
      { href: '/service-catalog', icon: Briefcase, label: 'Catálogo de Serviços' },
      { href: '/knowledge-base', icon: BookOpen, label: 'Base de Conhecimento' },
      { href: '/sla', icon: Clock, label: 'Gestão de SLA' },
      { href: '/workflows', icon: Workflow, label: 'Workflows' },
      { href: '/automations', icon: Cog, label: 'Automações' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/alerts', icon: Bell, label: 'Alertas' },
      { href: '/permissions', icon: ShieldCheck, label: 'Permissões' },
      { href: '/audit', icon: ScrollText, label: 'Log de Auditoria' },
      { href: '/settings', icon: Settings, label: 'Configurações' },
    ],
  },
];

// ── Sino de Notificações ───────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  job_completed:    'Job Concluído',
  job_failed:       'Falha no Job',
  new_assets_found: 'Novos Ativos Encontrados',
};

function channelIcon(channel: string) {
  if (channel.includes(',')) return <Zap    className="w-3 h-3 text-amber-400" />;
  if (channel === 'email')   return <Mail   className="w-3 h-3 text-blue-400" />;
  if (channel === 'webhook') return <Webhook className="w-3 h-3 text-violet-400" />;
  return null;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<{ items: AlertEvent[]; total: number }>({
    queryKey: ['notif-events'],
    queryFn:  () => alertsApi.events({ per_page: 20, page: 1 }).then(r => r.data),
    refetchInterval: 30_000,
    retry: false,
  });

  const allEvents   = data?.items ?? [];
  const failedCount = allEvents.filter(e => e.status === 'failed').length;
  const preview     = allEvents.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground relative"
        title="Notificações de alertas"
      >
        <Bell className="w-5 h-5" />
        {failedCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {failedCount > 9 ? '9+' : failedCount}
          </span>
        )}
        {failedCount === 0 && allEvents.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Cabeçalho */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Alertas Recentes</span>
            </div>
            {failedCount > 0 && (
              <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                {failedCount} com falha
              </span>
            )}
          </div>

          {/* Lista de eventos */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {preview.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum evento de alerta ainda</p>
              </div>
            ) : (
              preview.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    {ev.status === 'sent'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <XCircle      className="w-4 h-4 text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs font-medium ${ev.status === 'failed' ? 'text-red-400' : 'text-foreground'}`}>
                        {TRIGGER_LABELS[ev.trigger] ?? ev.trigger}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="flex items-center gap-0.5">{channelIcon(ev.channel)}</span>
                    </div>
                    {ev.error_message && (
                      <p className="text-xs text-red-400/80 truncate" title={ev.error_message}>
                        {ev.error_message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ev.discovery_job_id ? `Job #${ev.discovery_job_id} · ` : 'Teste · '}
                      {formatDate(ev.sent_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              Ver todos em Alertas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}


export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    if (!user) {
      authApi.me().then(r => setUser(r.data)).catch(() => {
        logout(); router.push('/login');
      });
    }
  }, [user, router, logout, setUser]);

  async function handleLogout() {
    try { await authApi.logout(); } catch {}
    logout();
    router.push('/login');
  }

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : 'U';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:relative z-30 flex flex-col h-full bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-fg))] transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-white/10">
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <Image
              src="/images/nexaops-logo.png"
              alt="NexaOps"
              width={36}
              height={36}
              className="rounded-md object-contain"
              style={{ width: 36, height: 36 }}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-base tracking-tight leading-tight block">NexaOps</span>
              <span className="text-[10px] text-slate-400 leading-tight">Smart Infrastructure</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-thin space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                        active
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Botão recolher */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center p-3 border-t border-white/10 hover:bg-white/5 transition text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card flex-shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-accent transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-2">
            {/* Alternar tema */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notificações */}
            <NotificationBell />

            {/* Usuário */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <div className="hidden md:block text-sm">
                <p className="font-medium leading-none">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.roles[0]?.replace('_', ' ') || 'usuário'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-destructive"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
