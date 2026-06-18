'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, authApi } from '@/services/api';
import Layout from '@/components/Layout';
import MfaSetupCard from '@/components/MfaSetupCard';
import { Save, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: settings } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list().then(r => r.data),
  });

  const { data: me } = useQuery<any>({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setEditKey(null); },
  });

  const sendTest = useMutation({
    mutationFn: (email: string) => settingsApi.testEmail(email),
    onSuccess: (res) => {
      setTestResult({ ok: true, message: res.data.message });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Erro ao enviar e-mail de teste.';
      setTestResult({ ok: false, message: msg });
    },
  });

  const handleTestEmail = () => {
    if (!testEmail.trim()) return;
    setTestResult(null);
    sendTest.mutate(testEmail.trim());
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configuração da plataforma e segurança</p>
        </div>

        <MfaSetupCard mfaEnabled={!!me?.mfa_enabled} />

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Configurações da Plataforma</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Clique em qualquer valor para editar diretamente</p>
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
                      onKeyDown={e => {
                        if (e.key === 'Escape') setEditKey(null);
                        if (e.key === 'Enter') save.mutate({ key: s.key, value: editValue });
                      }}
                    />
                    <button
                      onClick={() => save.mutate({ key: s.key, value: editValue })}
                      disabled={save.isPending}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditKey(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
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

        {/* SMTP Test Card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <div>
              <h2 className="font-semibold">Teste de E-mail SMTP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifica se as configurações SMTP estão corretas enviando um e-mail de teste
              </p>
            </div>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="destinatario@exemplo.com"
                value={testEmail}
                onChange={e => { setTestEmail(e.target.value); setTestResult(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleTestEmail(); }}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleTestEmail}
                disabled={sendTest.isPending || !testEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
              >
                {sendTest.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {sendTest.isPending ? 'Enviando…' : 'Enviar teste'}
              </button>
            </div>

            {testResult && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {testResult.ok
                  ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Certifique-se de que <code className="font-mono bg-background px-1 rounded">smtp_host</code> está definido nas configurações acima antes de testar.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
