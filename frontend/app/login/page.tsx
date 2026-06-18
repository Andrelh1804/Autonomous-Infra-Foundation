'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import Image from 'next/image';

type Step = 'credentials' | 'mfa';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser, logout } = useAuthStore();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      setError('Sessão expirada. Faça login novamente.');
      logout();
    }
  }, [searchParams, logout]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.data.mfa_required) {
        setMfaToken(res.data.mfa_token);
        setStep('mfa');
      } else {
        setTokens(res.data.access_token, res.data.refresh_token);
        const meRes = await authApi.me();
        setUser(meRes.data);
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      if (!err.response) {
        setError('Erro de conexão com o servidor. Tente novamente.');
      } else if (err.response.status === 401) {
        setError('Usuário ou senha inválidos.');
      } else if (err.response.status >= 500) {
        setError('Erro de conexão com o servidor. Tente novamente.');
      } else {
        setError(err.response?.data?.detail || 'Erro ao autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.mfaVerify(mfaToken, code);
      setTokens(res.data.access_token, res.data.refresh_token);
      const meRes = await authApi.me();
      setUser(meRes.data);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('MFA Error:', err);
      if (!err.response) {
        setError('Erro de conexão com o servidor. Tente novamente.');
      } else if (err.response.status === 401) {
        setError('Código inválido ou expirado. Tente novamente.');
      } else {
        setError(err.response?.data?.detail || 'Erro ao verificar código. Tente novamente.');
      }
      setCode('');
    } finally {
      setLoading(false);
    }
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
              width={160}
              height={160}
              className="drop-shadow-2xl"
              style={{ width: 160, height: 'auto' }}
              priority
            />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {step === 'credentials' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Entrar na sua conta</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCredentials} className="space-y-5" noValidate>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="admin@aii.local"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Entrando...
                    </span>
                  ) : 'Entrar'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setEmail('admin@aii.local'); setPassword('Admin@2024!'); }}
                  className="flex-1 text-center text-xs text-slate-500 hover:text-slate-300 transition py-2 border border-white/5 hover:border-white/15 rounded-lg"
                >
                  Preencher credenciais padrão
                </button>
                <a
                  href="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition whitespace-nowrap"
                >
                  Esqueceu a senha?
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Voltar */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setStep('credentials'); setError(''); setCode(''); }}
                  className="text-slate-400 hover:text-white transition"
                  title="Voltar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-white">Autenticação em dois fatores</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Digite o código de 6 dígitos do seu aplicativo autenticador</p>
                </div>
              </div>

              {/* Ícone escudo */}
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleMfa} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Código de verificação</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verificando...
                    </span>
                  ) : 'Verificar'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-500">
                Abra seu aplicativo autenticador (Google Authenticator, Authy, etc.) e insira o código atual de <span className="text-slate-400">{email}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
