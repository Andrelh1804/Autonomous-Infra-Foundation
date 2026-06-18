'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, auditApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Save } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AuditLog, PaginatedResponse } from '@/types';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: settings } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list().then(r => r.data),
  });

  const { data: auditData } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit'],
    queryFn: () => auditApi.list({ per_page: 20 }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setEditKey(null); },
  });

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform configuration</p>
        </div>

        {/* Settings */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Platform Settings</h2>
          </div>
          <div className="divide-y divide-border">
            {settings?.map(s => (
              <div key={s.key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{s.key}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setEditKey(null)}
                    />
                    <button
                      onClick={() => save.mutate({ key: s.key, value: editValue })}
                      disabled={save.isPending}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditKey(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                ) : (
                  <button
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-dashed border-border hover:border-solid hover:border-indigo-500 transition font-mono"
                    onClick={() => { setEditKey(s.key); setEditValue(s.value ?? ''); }}
                  >
                    {s.value || <span className="text-muted-foreground/50">—</span>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Audit Log</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Recent system activity</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['User', 'Action', 'Module', 'IP', 'Time'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditData?.items?.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-sm">{log.user_email || '—'}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</span></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{log.module}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ip_address || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
