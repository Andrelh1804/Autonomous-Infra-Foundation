'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { authApi } from '@/services/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token inválido. Solicite um novo link de redefinição.');
    }
  }, [token]);

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    if (password.length < 8) return { label: 'Fraca', color: 'bg-red-500', width: 'w-1/4' };
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return { label: 'Média', color: 'bg-amber-500', width: 'w-2/4' };
    if (/[^A-Za-z0-9]/.test(password))
      return { label: 'Forte', color: 'bg-emerald-500', width: 'w-full' };
    return { label: 'Boa', color: 'bg-indigo-500', width: 'w-3/4' };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (!err.response) {
        setError('Erro de conexão com o servidor. Tente novamente.');
      } else {
        setError(err.response?.data?.detail || 'Erro ao redefinir senha. O link pode ter expirado.');
      }
    } finally {
      setLoading(false);
    }
  }

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

          {!success ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Link href="/login" className="text-slate-400 hover:text-white transition" title="Voltar">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h2 className="text-xl font-semibold text-white">Nova senha</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Escolha uma senha segura para sua conta</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                  {(error.includes('expirado') || error.includes('inválido')) && (
                    <div className="mt-2">
                      <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 underline text-xs">
                        Solicitar novo link →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nova senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoFocus
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        className="w-full px-4 py-2.5 pr-11 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {passwordStrength && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Força da senha</span>
                          <span className={
                            passwordStrength.label === 'Fraca' ? 'text-red-400' :
                            passwordStrength.label === 'Média' ? 'text-amber-400' :
                            passwordStrength.label === 'Boa' ? 'text-indigo-400' : 'text-emerald-400'
                          }>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar nova senha</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                        confirm && confirm !== password
                          ? 'border-red-500/50 focus:ring-red-500'
                          : 'border-white/10 focus:ring-indigo-500'
                      }`}
                    />
                    {confirm && confirm !== password && (
                      <p className="mt-1 text-xs text-red-400">As senhas não coincidem</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password || !confirm || password !== confirm}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Salvando...
                      </span>
                    ) : 'Redefinir senha'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white text-center mb-2">Senha redefinida!</h2>
              <p className="text-slate-400 text-sm text-center mb-6">
                Sua senha foi alterada com sucesso. Todas as sessões anteriores foram encerradas por segurança.
              </p>

              <Link
                href="/login"
                className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition text-center"
              >
                Ir para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
