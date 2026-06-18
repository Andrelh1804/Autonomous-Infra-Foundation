'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { executiveAiApi } from '@/services/api';
import Layout from '@/components/Layout';
import { Search, Loader2, FileText, Ticket, Server, BookOpen, RefreshCw } from 'lucide-react';

const SEARCH_TYPES = [
  { value: 'all', label: 'Tudo', icon: Search },
  { value: 'knowledge', label: 'Conhecimento', icon: BookOpen },
  { value: 'tickets', label: 'Tickets', icon: Ticket },
  { value: 'assets', label: 'Ativos', icon: Server },
];

const SOURCE_ICONS: Record<string, React.ElementType> = {
  knowledge_article: BookOpen,
  ticket: Ticket,
  asset: Server,
};

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-violet-500/30 text-violet-200 rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

export default function AISearchPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [submitted, setSubmitted] = useState('');

  const search = useMutation({
    mutationFn: () => executiveAiApi.search({ query, search_type: searchType, limit: 12 }),
  });

  const indexDocs = useMutation({
    mutationFn: executiveAiApi.indexDocuments,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSubmitted(query);
    search.mutate();
  };

  const docs = search.data?.documents || [];
  const assets = search.data?.assets || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-violet-400" /> AI Search
            </h1>
            <p className="text-slate-400 text-sm mt-1">Busca semântica em ativos, tickets, base de conhecimento e documentos</p>
          </div>
          <button onClick={() => indexDocs.mutate()} disabled={indexDocs.isPending}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm border border-slate-700">
            {indexDocs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Indexar Docs
          </button>
        </div>

        {/* Search form */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Pesquisar na infraestrutura... (ex: servidor Dell, patch crítico, VPN)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:border-violet-500 text-sm"
                />
              </div>
              <button type="submit" disabled={!query.trim() || search.isPending}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2">
                {search.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>

            <div className="flex gap-2">
              {SEARCH_TYPES.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setSearchType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${searchType === value ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Results */}
        {search.isPending && (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
        )}

        {search.data && !search.isPending && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">{search.data.total} resultado(s) para "<span className="text-white">{submitted}</span>"</p>

            {/* Asset results */}
            {assets.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Ativos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assets.map((a: any, i: number) => (
                    <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex gap-3">
                      <Server className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white"><HighlightText text={a.title} query={submitted} /></p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document results */}
            {docs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Documentos e Registros</h3>
                <div className="space-y-3">
                  {docs.map((d: any, i: number) => {
                    const Icon = SOURCE_ICONS[d.source_type] || FileText;
                    return (
                      <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <Icon className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-medium text-white"><HighlightText text={d.title} query={submitted} /></h4>
                              <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2 py-0.5 capitalize">{d.source_type?.replace('_', ' ')}</span>
                              {d.score < 1 && <span className="text-xs text-violet-400">{Math.round(d.score * 100)}% relevante</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5 line-clamp-3">
                              <HighlightText text={d.content} query={submitted} />
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {search.data.total === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p>Nenhum resultado encontrado.</p>
                <p className="text-sm mt-1">Tente indexar os documentos primeiro clicando em "Indexar Docs".</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
