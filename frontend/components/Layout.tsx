'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, useThemeStore } from '@/store/auth';
import { authApi } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Building2, Users, MapPin, ShieldCheck,
  Settings, LogOut, Bell, Sun, Moon, ChevronLeft, ChevronRight, Menu, ScrollText,
  Radar, Server, Network, GitFork, History, ChevronDown
} from 'lucide-react';

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
            <button className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
            </button>

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
