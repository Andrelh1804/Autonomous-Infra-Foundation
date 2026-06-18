'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { authApi } from '@/services/api';

type Step = 'form' | 'email_sent' | 'link_ready';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [resetToken, setResetToken] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      if (res.data.email_sent) {
        setStep('email_sent');
      } else {
        setResetToken(res.data.reset_token ?? '');
        setStep('link_ready');
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      if (!err.response) {
        setError('Erro de conexão com o servidor. Tente novamente.');
      } else {
        setError(err.response?.data?.detail || 'Erro ao processar solicitação.');
      }
    } finally {
      setLoading(false);
    }
  }

  const resetLink = resetToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password?token=${resetToken}`
    : '';

  async function copyLink() {
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src="/images/nexaops-logo.png"
              alt="NexaOps"
              width={140}
              height={140}
              className="drop-shadow-2xl"
              style={{ width: 140, height: 'auto' }}
              priority
            />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Back + title */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/login" className="text-slate-400 hover:text-white transition" title="Voltar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h2 className="text-xl font-semibold text-white">Recuperar senha</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {step === 'form'
                  ? 'Informe o e-mail da sua conta'
                  : step === 'email_sent'
                  ? 'Verifique sua caixa de entrada'
                  : 'Link de redefinição gerado'}
              </p>
            </div>
          </div>

          {/* ── FORM ── */}
          {step === 'form' && (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando...
                    </span>
                  ) : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          )}

          {/* ── EMAIL SENT ── */}
          {step === 'email_sent' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <p className="text-slate-300 text-sm text-center mb-2">
                Enviamos um link de redefinição para
              </p>
              <p className="text-white font-semibold text-center mb-5 font-mono text-sm">
                {email}
              </p>
              <p className="text-slate-400 text-xs text-center mb-6">
                O link expira em <span className="text-white font-medium">1 hora</span>.
                Verifique também a pasta de spam.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setEmail(''); }}
                  className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium rounded-lg transition text-sm"
                >
                  Usar outro e-mail
                </button>
                <Link
                  href="/login"
                  className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition text-sm text-center"
                >
                  Voltar ao login
                </Link>
              </div>
            </>
          )}

          {/* ── LINK READY (SMTP not configured — fallback) ── */}
          {step === 'link_ready' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>

              <p className="text-slate-300 text-sm text-center mb-5">
                Link gerado. Copie e compartilhe com o usuário — expira em{' '}
                <span className="text-white font-medium">1 hora</span>.
              </p>

              {resetLink && (
                <div className="mb-5">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Link de redefinição
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={resetLink}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className={`px-3 py-2 border rounded-lg transition text-xs font-semibold whitespace-nowrap ${
                        copied
                          ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/40 border-indigo-500/30 text-indigo-400'
                      }`}
                    >
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs mb-5 leading-relaxed">
                <strong>SMTP não configurado.</strong> Configure as credenciais SMTP em{' '}
                <Link href="/settings" className="underline hover:text-amber-300 transition">
                  Configurações
                </Link>{' '}
                para enviar links por e-mail automaticamente.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setEmail(''); setResetToken(''); }}
                  className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium rounded-lg transition text-sm"
                >
                  Gerar outro
                </button>
                <Link
                  href="/login"
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition text-sm text-center"
                >
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
