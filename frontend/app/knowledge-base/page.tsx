'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeBaseApi } from '@/services/api';
import Layout from '@/components/Layout';
import { BookOpen, Plus, Search, ThumbsUp, Eye, Pencil, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-400', published: 'bg-emerald-500/10 text-emerald-400',
  archived: 'bg-slate-700/50 text-slate-500',
};
const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' };

function ArticleModal({ open, onClose, article }: { open: boolean; onClose: () => void; article?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: article?.title ?? '', content: article?.content ?? '',
    category: article?.category ?? '', tags: article?.tags ?? '', status: article?.status ?? 'draft',
  });
  const mut = useMutation({
    mutationFn: (d: any) => article ? knowledgeBaseApi.update(article.id, d) : knowledgeBaseApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); onClose(); },
  });
  if (!open) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{article ? 'Editar Artigo' : 'Novo Artigo'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-slate-400 mb-1 block">Título *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Tags (separadas por vírgula)</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option>
              </select></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Conteúdo</label>
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={12} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none font-mono" placeholder="Escreva o artigo aqui... Suporta Markdown." /></div>
        </div>
        <div className="p-5 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.title} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50">
            {mut.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['knowledge-base', search, category, status], queryFn: () => knowledgeBaseApi.list({ search, category, status }) });
  const { data: categories = [] } = useQuery({ queryKey: ['kb-categories'], queryFn: knowledgeBaseApi.listCategories });
  const delMut = useMutation({ mutationFn: (id: number) => knowledgeBaseApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-base'] }) });
  const voteMut = useMutation({ mutationFn: (id: number) => knowledgeBaseApi.voteHelpful(id) });
  const items = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white">Base de Conhecimento</h1><p className="text-slate-400 mt-1">Artigos, procedimentos e soluções documentadas</p></div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Novo Artigo
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar artigos..." className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="">Todas categorias</option>
            {(categories as string[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="">Todos status</option>
            <option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option>
          </select>
        </div>
        <div className="space-y-3">
          {isLoading ? <div className="text-center text-slate-400 py-8">Carregando...</div> :
            items.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Base de conhecimento vazia. Crie o primeiro artigo!</p>
              </div>
            ) : items.map((art: any) => (
              <div key={art.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-indigo-500/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{art.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[art.status] || ''}`}>{STATUS_LABELS[art.status] || art.status}</span>
                    </div>
                    {art.category && <p className="text-xs text-indigo-400 mb-2">{art.category}</p>}
                    {art.tags && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {art.tags.split(',').map((tag: string) => (
                          <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    {art.content && <p className="text-slate-400 text-xs line-clamp-2">{art.content}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {art.views}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {art.helpful_votes}</span>
                      <span>v{art.version} · {art.updated_at ? new Date(art.updated_at).toLocaleDateString('pt-BR') : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => voteMut.mutate(art.id)} className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-700 transition-colors" title="Útil"><ThumbsUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditing(art); setModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Excluir?')) delMut.mutate(art.id); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          <div className="text-xs text-slate-500">{total} artigos encontrados</div>
        </div>
        <ArticleModal open={modal} onClose={() => setModal(false)} article={editing} />
      </div>
    </Layout>
  );
}
