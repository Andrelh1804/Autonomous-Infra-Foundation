'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { ocsApi } from '@/services/api';
import {
  Database, Plus, Wifi, WifiOff, AlertCircle, RefreshCw, Play,
  Pause, Trash2, Settings, CheckCircle2, Clock, Server,
  Package, Users, Network, Save, X, Eye, EyeOff, Loader2,
  ChevronRight, Activity,
} from 'lucide-react';
import Link from 'next/link';

type Integration = {
  id: number;
  name: string;
  url: string;
  username: string;
  auth_type: string;
  status: string;
  is_enabled: boolean;
  is_paused: boolean;
  last_sync_at: string | null;
  next_sync_at: string | null;
  last_test_at: string | null;
  last_test_error: string | null;
  total_assets: number;
  total_software: number;
  total_users: number;
  total_networks: number;
  sync_interval_minutes: number;
  timeout_seconds: number;
  retry_count: number;
  ssl_verify: boolean;
};

const AUTH_TYPES = [
  { value: 'basic', label: 'Basic Auth (usuário/senha)' },
  { value: 'token', label: 'Bearer Token' },
  { value: 'apikey', label: 'API Key' },
];

const INTERVALS = [
  { value: 5, label: '5 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

function statusBadge(status: string, paused: boolean) {
  if (paused) return <span className="flex items-center gap-1 text-xs text-amber-400 font-medium"><Pause className="w-3 h-3" /> Pausado</span>;
  if (status === 'connected') return <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><Wifi className="w-3 h-3" /> Conectado</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><AlertCircle className="w-3 h-3" /> Erro</span>;
  return <span className="flex items-center gap-1 text-xs text-slate-400 font-medium"><WifiOff className="w-3 h-3" /> Desconectado</span>;
}

function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR');
}

const EMPTY_FORM = {
  name: '', url: '', username: '', password: '', api_token: '',
  auth_type: 'basic', timeout_seconds: 30, retry_count: 3,
  sync_interval_minutes: 60, ssl_verify: true,
};

export default function OcsIntegrationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showPass, setShowPass] = useState(false);
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { data: list = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['ocs-integrations'],
    queryFn: () => ocsApi.list().then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: object) => ocsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs-integrations'] }); setShowForm(false); setForm({ ...EMPTY_FORM }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => ocsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs-integrations'] }); setShowForm(false); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => ocsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocs-integrations'] }),
  });

  const testMut = useMutation({
    mutationFn: (id: number) => ocsApi.test(id),
    onSuccess: (res, id) => {
      setTestResult({ id, ok: res.data.success, msg: res.data.message + (res.data.computer_count ? ` (${res.data.computer_count} computers)` : '') });
      qc.invalidateQueries({ queryKey: ['ocs-integrations'] });
    },
    onError: (err: any, id) => setTestResult({ id, ok: false, msg: err?.response?.data?.detail ?? 'Falha na conexão' }),
  });

  const syncMut = useMutation({
    mutationFn: ({ id, full }: { id: number; full: boolean }) =>
      full ? ocsApi.fullSync(id) : ocsApi.incrementalSync(id),
    onSuccess: (res) => { setSyncMsg(res.data.message); qc.invalidateQueries({ queryKey: ['ocs-integrations'] }); },
  });

  const pauseMut = useMutation({
    mutationFn: (id: number) => ocsApi.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocs-integrations'] }),
  });

  const resumeMut = useMutation({
    mutationFn: (id: number) => ocsApi.resume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocs-integrations'] }),
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(integ: Integration) {
    setForm({
      name: integ.name, url: integ.url, username: integ.username ?? '',
      password: '', api_token: '', auth_type: integ.auth_type,
      timeout_seconds: integ.timeout_seconds, retry_count: integ.retry_count,
      sync_interval_minutes: integ.sync_interval_minutes, ssl_verify: integ.ssl_verify,
    });
    setEditId(integ.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (editId) {
      updateMut.mutate({ id: editId, data: form });
    } else {
      createMut.mutate(form);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/integrations" className="hover:text-foreground transition">Integrações</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>OCS Inventory NG</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-400" />
              OCS Inventory NG
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conector corporativo de inventário — hardware, software, usuários e redes
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Nova Integração
          </button>
        </div>

        {/* Sync feedback */}
        {syncMsg && (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <span className="text-sm text-emerald-400">{syncMsg}</span>
            <button onClick={() => setSyncMsg(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">{editId ? 'Editar Integração' : 'Nova Integração OCS'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome da Integração">
                <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex.: OCS Produção" />
              </Field>
              <Field label="URL do OCS">
                <input className="field-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://ocs.empresa.local" />
              </Field>
              <Field label="Tipo de Autenticação">
                <select className="field-input" value={form.auth_type} onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}>
                  {AUTH_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              {form.auth_type === 'basic' && (
                <>
                  <Field label="Usuário">
                    <input className="field-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                  </Field>
                  <Field label="Senha">
                    <div className="relative">
                      <input className="field-input pr-9" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editId ? '(manter atual)' : ''} />
                      <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </>
              )}
              {(form.auth_type === 'token' || form.auth_type === 'apikey') && (
                <Field label="API Token">
                  <input className="field-input" type="password" value={form.api_token} onChange={e => setForm(f => ({ ...f, api_token: e.target.value }))} placeholder={editId ? '(manter atual)' : ''} />
                </Field>
              )}
              <Field label="Intervalo de Sincronização">
                <select className="field-input" value={form.sync_interval_minutes} onChange={e => setForm(f => ({ ...f, sync_interval_minutes: Number(e.target.value) }))}>
                  {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </Field>
              <Field label="Timeout (segundos)">
                <input className="field-input" type="number" value={form.timeout_seconds} onChange={e => setForm(f => ({ ...f, timeout_seconds: Number(e.target.value) }))} />
              </Field>
              <Field label="Tentativas">
                <input className="field-input" type="number" min={1} max={10} value={form.retry_count} onChange={e => setForm(f => ({ ...f, retry_count: Number(e.target.value) }))} />
              </Field>
              <Field label="Validar SSL">
                <label className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={form.ssl_verify} onChange={e => setForm(f => ({ ...f, ssl_verify: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-sm">Verificar certificado SSL</span>
                </label>
              </Field>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition">Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Nenhuma integração configurada</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Clique em "Nova Integração" para conectar um servidor OCS Inventory NG</p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map(integ => (
              <div key={integ.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Database className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{integ.name}</span>
                        {statusBadge(integ.status, integ.is_paused)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{integ.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Test */}
                    <button
                      onClick={() => testMut.mutate(integ.id)}
                      disabled={testMut.isPending && testMut.variables === integ.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent transition"
                      title="Testar Conexão"
                    >
                      {testMut.isPending && testMut.variables === integ.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Wifi className="w-3.5 h-3.5" />}
                      Testar
                    </button>
                    {/* Incremental sync */}
                    <button
                      onClick={() => syncMut.mutate({ id: integ.id, full: false })}
                      disabled={integ.is_paused}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent transition disabled:opacity-40"
                      title="Sincronização Incremental"
                    >
                      <Activity className="w-3.5 h-3.5 text-amber-400" /> Incremental
                    </button>
                    {/* Full sync */}
                    <button
                      onClick={() => syncMut.mutate({ id: integ.id, full: true })}
                      disabled={integ.is_paused}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition disabled:opacity-40"
                      title="Sincronização Completa"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Sincronização Completa
                    </button>
                    {/* Pause / Resume */}
                    {integ.is_paused ? (
                      <button onClick={() => resumeMut.mutate(integ.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition">
                        <Play className="w-3.5 h-3.5" /> Reativar
                      </button>
                    ) : (
                      <button onClick={() => pauseMut.mutate(integ.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition">
                        <Pause className="w-3.5 h-3.5" /> Pausar
                      </button>
                    )}
                    {/* Edit */}
                    <button onClick={() => openEdit(integ)} className="p-1.5 rounded-lg border border-border hover:bg-accent transition">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
                    <button onClick={() => { if (confirm('Excluir integração e todos os dados?')) deleteMut.mutate(integ.id); }}
                      className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Test result feedback */}
                {testResult?.id === integ.id && (
                  <div className={`mx-5 mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {testResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    {testResult.msg}
                    <button onClick={() => setTestResult(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {/* Stats row */}
                <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat icon={<Server className="w-3.5 h-3.5 text-blue-400" />} label="Ativos" value={integ.total_assets} />
                  <Stat icon={<Package className="w-3.5 h-3.5 text-violet-400" />} label="Softwares" value={integ.total_software} />
                  <Stat icon={<Users className="w-3.5 h-3.5 text-amber-400" />} label="Usuários" value={integ.total_users} />
                  <Stat icon={<Network className="w-3.5 h-3.5 text-emerald-400" />} label="Redes" value={integ.total_networks} />
                </div>

                {/* Sync times */}
                <div className="px-5 pb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Última sync: <b className="text-foreground">{fmt(integ.last_sync_at)}</b></span>
                  <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Próxima: <b className="text-foreground">{fmt(integ.next_sync_at)}</b></span>
                  <Link href={`/integrations/ocs/logs?id=${integ.id}`} className="text-indigo-400 hover:underline ml-auto">Ver Logs →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .field-input {
          width: 100%;
          padding: 8px 12px;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          color: hsl(var(--foreground));
        }
        .field-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
      `}</style>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2.5 flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-semibold mt-0.5">{value.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  );
}
