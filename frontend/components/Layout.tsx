'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useThemeStore } from '@/store/auth';
import { authApi, alertsApi } from '@/services/api';
import { cn, formatDate } from '@/lib/utils';
import {
  LayoutDashboard, Building2, Users, MapPin, ShieldCheck,
  Settings, LogOut, Bell, Sun, Moon, ChevronLeft, ChevronRight, Menu, ScrollText,
  Radar, Server, Network, GitFork, History, ChevronDown,
  XCircle, Mail, Webhook, Zap, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import type { AlertEvent } from '@/types';

const NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/organizations', icon: Building2, label: 'Organizations' },
      { href: '/users', icon: Users, label: 'Users' },
      { href: '/sites', icon: MapPin, label: 'Sites' },
    ],
  },
  {
    label: 'Discovery & CMDB',
    items: [
      { href: '/discovery', icon: Radar, label: 'Discovery' },
      { href: '/assets', icon: Server, label: 'Assets / CMDB' },
      { href: '/network-map', icon: Network, label: 'Network Map' },
      { href: '/relationships', icon: GitFork, label: 'Relationships' },
      { href: '/asset-history', icon: History, label: 'Asset History' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/alerts', icon: Bell, label: 'Alerts' },
      { href: '/permissions', icon: ShieldCheck, label: 'Permissions' },
      { href: '/audit', icon: ScrollText, label: 'Audit Log' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

// ── Notification Bell ─────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  job_completed:    'Job Completed',
  job_failed:       'Job Failed',
  new_assets_found: 'New Assets Found',
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

  // Poll all recent events; filter failed client-side for badge
  const { data } = useQuery<{ items: AlertEvent[]; total: number }>({
    queryKey: ['notif-events'],
    queryFn:  () => alertsApi.events({ per_page: 20, page: 1 }).then(r => r.data),
    refetchInterval: 30_000,
    retry: false,
  });

  const allEvents   = data?.items ?? [];
  const failedCount = allEvents.filter(e => e.status === 'failed').length;
  const preview     = allEvents.slice(0, 8);

  // Close on outside click
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
        title="Alert notifications"
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
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Alerts</span>
            </div>
            {failedCount > 0 && (
              <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                {failedCount} failed
              </span>
            )}
          </div>

          {/* Events list */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {preview.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No alert events yet</p>
              </div>
            ) : (
              preview.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {ev.status === 'sent'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <XCircle      className="w-4 h-4 text-red-400" />
                    }
                  </div>
                  {/* Body */}
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
                      {ev.discovery_job_id ? `Job #${ev.discovery_job_id} · ` : 'Test · '}
                      {formatDate(ev.sent_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              View all in Alerts →
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
      {/* Mobile overlay */}
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          {!collapsed && <span className="font-bold text-lg tracking-tight">AII Platform</span>}
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

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center p-3 border-t border-white/10 hover:bg-white/5 transition text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card flex-shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-accent transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* User */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <div className="hidden md:block text-sm">
                <p className="font-medium leading-none">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.roles[0]?.replace('_', ' ') || 'user'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-destructive"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
