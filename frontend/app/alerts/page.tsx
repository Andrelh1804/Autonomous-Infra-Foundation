'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/services/api';
import Layout from '@/components/Layout';
import { formatDate } from '@/lib/utils';
import type { AlertRule, AlertEvent, AlertStats, PaginatedResponse } from '@/types';
import {
  Bell, Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Loader2,
  CheckCircle2, XCircle, Mail, Webhook, Zap, AlertTriangle,
  Play, ChevronDown, ChevronRight, Info,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIGGERS = [
  { value: 'job_completed',    label: 'Job Completed',    desc: 'When any discovery job finishes successfully',  color: 'text-emerald-400 bg-emerald-400/10' },
  { value: 'job_failed',       label: 'Job Failed',       desc: 'When a discovery job encounters an error',      color: 'text-red-400 bg-red-400/10' },
  { value: 'new_assets_found', label: 'New Assets Found', desc: 'When a scan discovers hosts above a threshold', color: 'text-indigo-400 bg-indigo-400/10' },
];

const CHANNELS = [
  { value: 'email',   label: 'Email',   icon: Mail },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
  { value: 'email,webhook', label: 'Both', icon: Zap },
];

// ── Alert Rule Modal ───────────────────────────────────────────────────────────

function RuleModal({ open, onClose, rule }: { open: boolean; onClose: () => void; rule?: AlertRule }) {
  const qc = useQueryClient();

  const [name,       setName]       = useState(rule?.name ?? '');
  const [trigger,    setTrigger]    = useState(rule?.trigger ?? 'job_completed');
  const [minHosts,   setMinHosts]   = useState(String(rule?.min_hosts_found ?? 1));
  const [channel,    setChannel]    = useState(rule?.channel ?? 'email');
  const [recipients, setRecipients] = useState(rule?.email_recipients ?? '');
  const [webhookUrl, setWebhookUrl] = useState(rule?.webhook_url ?? '');
  const [webhookSec, setWebhookSec] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: object) => rule
      ? alertsApi.updateRule(rule.id, data).then(r => r.data)
      : alertsApi.createRule(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
      qc.invalidateQueries({ queryKey: ['alert-stats'] });
      onClose();
    },
  });

  if (!open) return null;

  const needsEmail   = channel.includes('email');
  const needsWebhook = channel.includes('webhook');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      name,
      trigger,
      min_hosts_found: parseInt(minHosts) || 1,
      channel,
      email_recipients: needsEmail ? recipients : undefined,
      webhook_url:      needsWebhook ? webhookUrl : undefined,
      webhook_secret:   needsWebhook && webhookSec ? webhookSec : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold">{rule ? 'Edit Alert Rule' : 'New Alert Rule'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Rule Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Notify team on scan failure"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium mb-2">Trigger Condition</label>
            <div className="space-y-2">
              {TRIGGERS.map(t => (
                <label key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${trigger === t.value ? 'border-indigo-500 bg-indigo-500/5' : 'border-border hover:border-border/80 hover:bg-accent/30'}`}>
                  <input type="radio" name="trigger" value={t.value}
                    checked={trigger === t.value} onChange={() => setTrigger(t.value)}
                    className="mt-0.5 accent-indigo-500" />
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
                    <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Min hosts threshold */}
          {trigger === 'new_assets_found' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Minimum hosts found</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={minHosts} onChange={e => setMinHosts(e.target.value)}
                  className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-sm text-muted-foreground">or more hosts must be discovered</span>
              </div>
            </div>
          )}

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium mb-2">Notification Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(ch => {
                const Icon = ch.icon;
                return (
                  <button type="button" key={ch.value} onClick={() => setChannel(ch.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition ${channel === ch.value ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-border hover:bg-accent'}`}>
                    <Icon className="w-4 h-4" />
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email config */}
          {needsEmail && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Recipients <span className="text-red-400">*</span>
                <span className="text-muted-foreground font-normal ml-1">(comma-separated)</span>
              </label>
              <textarea value={recipients} onChange={e => setRecipients(e.target.value)}
                rows={2} placeholder="alice@company.com, bob@company.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                SMTP must be configured in Platform Settings for email delivery.
              </p>
            </div>
          )}

          {/* Webhook config */}
          {needsWebhook && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Webhook URL <span className="text-red-400">*</span></label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Secret <span className="text-muted-foreground font-normal">(optional — HMAC-SHA256 signature)</span>
                </label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={webhookSec} onChange={e => setWebhookSec(e.target.value)}
                    placeholder={rule ? '(unchanged)' : 'Enter signing secret…'}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" onClick={() => setShowSecret(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  If set, each POST includes an <code className="bg-muted px-1 rounded">X-AII-Signature: sha256=…</code> header.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              {(error as any)?.response?.data?.detail || 'Failed to save rule'}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rules Tab ──────────────────────────────────────────────────────────────────

function triggerBadge(trigger: string) {
  const t = TRIGGERS.find(x => x.value === trigger);
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t?.color ?? 'bg-slate-400/10 text-slate-400'}`}>{t?.label ?? trigger}</span>;
}

function channelIcon(channel: string) {
  if (channel.includes(',') || channel === 'both') return <Zap className="w-4 h-4 text-amber-400" />;
  if (channel === 'email')   return <Mail    className="w-4 h-4 text-blue-400" />;
  if (channel === 'webhook') return <Webhook className="w-4 h-4 text-violet-400" />;
  return null;
}

function RulesTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editRule,  setEditRule]  = useState<AlertRule | undefined>();

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: () => alertsApi.rules().then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => alertsApi.toggleRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => alertsApi.testRule(id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertsApi.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
      qc.invalidateQueries({ queryKey: ['alert-stats'] });
    },
  });

  return (
    <>
      <RuleModal open={showModal || !!editRule} onClose={() => { setShowModal(false); setEditRule(undefined); }} rule={editRule} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">No alert rules yet</p>
            <p className="text-muted-foreground text-sm">Create rules to get notified when discovery scans complete, fail, or find new assets.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className={`bg-card border rounded-xl p-5 transition-all ${rule.is_enabled ? 'border-border' : 'border-border opacity-60'}`}>
                <div className="flex items-start gap-4">
                  {/* Toggle */}
                  <button onClick={() => toggleMutation.mutate(rule.id)}
                    className={`mt-0.5 transition-colors flex-shrink-0 ${rule.is_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'}`}>
                    {rule.is_enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${rule.is_enabled ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}>
                        {rule.is_enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {triggerBadge(rule.trigger)}
                      <span className="text-muted-foreground">→</span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {channelIcon(rule.channel)}
                        <span className="capitalize text-xs">{rule.channel}</span>
                      </span>
                      {rule.trigger === 'new_assets_found' && (
                        <span className="text-xs text-muted-foreground">≥ {rule.min_hosts_found} host{rule.min_hosts_found !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Recipients / URL preview */}
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {rule.email_recipients && (
                        <p className="truncate"><span className="text-blue-400">✉</span> {rule.email_recipients}</p>
                      )}
                      {rule.webhook_url && (
                        <p className="truncate font-mono"><span className="text-violet-400">⚡</span> {rule.webhook_url}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => testMutation.mutate(rule.id)}
                      disabled={testMutation.isPending}
                      title="Send test notification"
                      className="p-2 rounded-lg hover:bg-amber-400/10 text-muted-foreground hover:text-amber-400 transition">
                      {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditRule(rule)} title="Edit"
                      className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id); }}
                      className="p-2 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Events Tab ─────────────────────────────────────────────────────────────────

function EventsTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ items: AlertEvent[]; total: number; pages: number }>({
    queryKey: ['alert-events', page],
    queryFn: () => alertsApi.events({ page, per_page: 50 }).then(r => r.data),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} event{(data?.total ?? 0) !== 1 ? 's' : ''} dispatched</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">No events yet. Alert events appear here when rules fire.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {['Status', 'Trigger', 'Channel', 'Job', 'Sent At', 'Error'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map(ev => (
                    <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {ev.status === 'sent'
                          ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Sent</span>
                          : <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Failed</span>
                        }
                      </td>
                      <td className="px-4 py-3">{triggerBadge(ev.trigger)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {channelIcon(ev.channel)}<span className="capitalize">{ev.channel}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {ev.discovery_job_id ? `#${ev.discovery_job_id}` : <span className="italic">test</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(ev.sent_at)}</td>
                      <td className="px-4 py-3">
                        {ev.error_message
                          ? <span className="text-red-400 text-xs truncate max-w-xs block" title={ev.error_message}>{ev.error_message}</span>
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Page {page} of {data.pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pages} className="px-3 py-1 rounded-lg border border-border text-xs hover:bg-accent disabled:opacity-50 transition">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [tab, setTab] = useState<'rules' | 'events'>('rules');

  const { data: stats } = useQuery<AlertStats>({
    queryKey: ['alert-stats'],
    queryFn: () => alertsApi.stats().then(r => r.data),
    refetchInterval: 15000,
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Alert Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Get notified via email or webhook when discovery events occur
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Rules',    value: stats?.total_rules   ?? 0, color: 'text-slate-300' },
            { label: 'Active Rules',   value: stats?.enabled_rules ?? 0, color: 'text-emerald-400' },
            { label: 'Total Events',   value: stats?.total_events  ?? 0, color: 'text-indigo-400' },
            { label: 'Sent',           value: stats?.sent_events   ?? 0, color: 'text-emerald-400' },
            { label: 'Failed',         value: stats?.failed_events ?? 0, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Email delivery</span> requires SMTP configured in{' '}
            <a href="/settings" className="text-indigo-400 hover:underline">Platform Settings</a>.
            {' '}<span className="font-medium text-foreground">Webhooks</span> receive a JSON POST with an optional{' '}
            <code className="bg-muted px-1 rounded text-xs">X-AII-Signature</code> HMAC-SHA256 header for verification.
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {([
            { id: 'rules',  label: 'Rules',  icon: Bell },
            { id: 'events', label: 'Events', icon: CheckCircle2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
              {id === 'events' && (stats?.total_events ?? 0) > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{stats?.total_events}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'rules'  && <RulesTab />}
        {tab === 'events' && <EventsTab />}
      </div>
    </Layout>
  );
}
