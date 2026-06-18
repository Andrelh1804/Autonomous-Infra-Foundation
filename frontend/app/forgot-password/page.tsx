'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { authApi } from '@/services/api';

type Step = 'form' | 'done';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [resetToken, setResetToken] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setResetToken(res.data.reset_token ?? '');
      setStep('done');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

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

          {/* Voltar */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/login"
              className="text-slate-400 hover:text-white transition"
              title="Voltar ao login"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h2 className="text-xl font-semibold text-white">Recuperar senha</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {step === 'form' ? 'Informe o e-mail da sua conta' : 'Link de redefinição gerado'}
              </p>
            </div>
          </div>

          {step === 'form' ? (
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
                    placeholder="seu@email.com"
                    autoComplete="email"
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
                      Gerando link...
                    </span>
                  ) : 'Gerar link de redefinição'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Sucesso */}
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <p className="text-slate-300 text-sm text-center mb-5">
                Link de redefinição gerado. Copie o link abaixo e compartilhe com o usuário.
                O link expira em <span className="text-white font-medium">1 hora</span>.
              </p>

              {resetLink && (
                <div className="mb-5">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Link de redefinição</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={resetLink}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(resetLink)}
                      className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 rounded-lg transition text-xs font-medium whitespace-nowrap"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs mb-5">
                <strong>Atenção:</strong> Em produção, integre um serviço de e-mail para enviar este link automaticamente.
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
