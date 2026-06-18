'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import QRCode from 'react-qr-code';

type MfaPhase = 'idle' | 'setup' | 'disabling';

export default function MfaSetupCard({ mfaEnabled }: { mfaEnabled: boolean }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<MfaPhase>('idle');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: setupData, isFetching: setupLoading } = useQuery<{ secret: string; otpauth_uri: string }>({
    queryKey: ['mfa-setup'],
    queryFn: () => authApi.mfaSetup().then(r => r.data),
    enabled: phase === 'setup',
    staleTime: Infinity,
  });

  const enable = useMutation({
    mutationFn: (c: string) => authApi.mfaEnable(c),
    onSuccess: () => {
      setSuccess('MFA enabled! Your account is now protected.');
      setPhase('idle');
      setCode('');
      qc.invalidateQueries({ queryKey: ['me'] });
      // Reload to refresh mfa_enabled state in parent
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail || 'Invalid code. Try again.');
      setCode('');
    },
  });

  const disable = useMutation({
    mutationFn: (opts: { code?: string; password?: string }) => authApi.mfaDisable(opts),
    onSuccess: () => {
      setSuccess('MFA disabled.');
      setPhase('idle');
      setCode('');
      setPassword('');
      qc.invalidateQueries({ queryKey: ['me'] });
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail || 'Invalid code or password.');
    },
  });

  function startSetup() {
    setError('');
    setSuccess('');
    setCode('');
    setPhase('setup');
  }

  function startDisable() {
    setError('');
    setSuccess('');
    setCode('');
    setPassword('');
    setPhase('disabling');
  }

  function cancel() {
    setPhase('idle');
    setError('');
    setCode('');
    setPassword('');
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Two-Factor Authentication</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add an extra layer of security to your account
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
          mfaEnabled
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
            : 'bg-slate-500/15 text-slate-400 border-slate-500/20'
        }`}>
          {mfaEnabled ? '● Enabled' : '○ Disabled'}
        </span>
      </div>

      <div className="p-5 space-y-4">

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
            {success}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* ── Idle state ────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {mfaEnabled
                  ? 'MFA is active. Every login requires a 6-digit code from your authenticator app.'
                  : 'Use an authenticator app (Google Authenticator, Authy, 1Password) to generate time-based codes.'}
              </p>
              <div className="mt-3">
                {mfaEnabled ? (
                  <button onClick={startDisable}
                    className="px-4 py-2 text-sm bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-lg transition">
                    Disable MFA
                  </button>
                ) : (
                  <button onClick={startSetup}
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-lg shadow-indigo-500/20">
                    Set up MFA
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Setup flow ────────────────────────────────────────────────── */}
        {phase === 'setup' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-sm font-medium">Step 1 — Scan this QR code</p>
              <p className="text-xs text-muted-foreground">
                Open your authenticator app and scan the QR code below, or enter the secret key manually.
              </p>
            </div>

            {setupLoading || !setupData ? (
              <div className="flex justify-center">
                <div className="w-44 h-44 bg-muted/30 rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl shadow-inner">
                  <QRCode value={setupData.otpauth_uri} size={160} />
                </div>
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1">Manual entry key</p>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border">
                    <code className="text-xs font-mono flex-1 select-all break-all text-foreground">
                      {setupData.secret}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(setupData.secret)}
                      className="text-xs text-muted-foreground hover:text-foreground transition whitespace-nowrap"
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium">Step 2 — Verify your code</p>
              <p className="text-xs text-muted-foreground">Enter the 6-digit code from your app to confirm setup.</p>
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                autoComplete="off"
                placeholder="000000"
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:tracking-normal placeholder:text-muted-foreground/40"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={cancel}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">
                Cancel
              </button>
              <button
                onClick={() => enable.mutate(code)}
                disabled={code.length !== 6 || enable.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition"
              >
                {enable.isPending ? 'Verifying…' : 'Enable MFA'}
              </button>
            </div>
          </div>
        )}

        {/* ── Disable flow ──────────────────────────────────────────────── */}
        {phase === 'disabling' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your current TOTP code <em>or</em> account password to confirm.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">TOTP Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center tracking-widest"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Account Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={cancel}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition">
                Cancel
              </button>
              <button
                onClick={() => disable.mutate({ code: code || undefined, password: password || undefined })}
                disabled={(!code && !password) || disable.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-60 transition"
              >
                {disable.isPending ? 'Disabling…' : 'Disable MFA'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
