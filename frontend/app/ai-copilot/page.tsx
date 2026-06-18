'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiCopilotApi } from '@/services/api';
import Layout from '@/components/Layout';
import {
  MessageSquareText, Send, Plus, Trash2, Bot, User,
  Zap, ChevronRight, Loader2, Settings, Info,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Message = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  latency_ms?: number;
  created_at?: string;
};

type Conversation = {
  id: number;
  title: string;
  model: string;
  total_tokens: number;
  updated_at: string;
};

const QUICK_PROMPTS = [
  'Quais ativos estão em estado crítico?',
  'Mostre os tickets de maior prioridade abertos',
  'Quais vulnerabilidades críticas estão abertas?',
  'Quais licenças vencem nos próximos 30 dias?',
  'Como está a saúde geral da TI?',
  'Mostre impressoras com problema',
];

export default function AICopilotPage() {
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['ai-conversations'],
    queryFn: aiCopilotApi.listConversations,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: aiCopilotApi.getStats,
  });

  const loadConversation = async (id: number) => {
    setActiveConvId(id);
    const data = await aiCopilotApi.getConversation(id);
    setMessages(data.messages || []);
  };

  const deleteConv = useMutation({
    mutationFn: (id: number) => aiCopilotApi.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      setActiveConvId(null);
      setMessages([]);
    },
  });

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    setInput('');
    setIsTyping(true);

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await aiCopilotApi.chat({
        message: msg,
        conversation_id: activeConvId || undefined,
      });
      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
        qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      }
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.content,
          tools_used: res.tools_used,
          latency_ms: res.latency_ms,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ Erro: ${err?.response?.data?.detail || 'Falha ao comunicar com a IA'}` },
      ]);
    } finally {
      setIsTyping(false);
      qc.invalidateQueries({ queryKey: ['ai-conversations'] });
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNew = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mt-6 -mx-6">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={startNew}
              className="w-full flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova Conversa
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="p-3 border-b border-slate-700 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Provedor</span>
                <span className={stats.is_configured ? 'text-emerald-400' : 'text-amber-400'}>
                  {stats.is_configured ? stats.provider : '⚠ não configurado'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Modelo</span>
                <span className="text-slate-300">{stats.model}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tokens totais</span>
                <span className="text-slate-300">{(stats.total_tokens || 0).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map(c => (
              <div
                key={c.id}
                className={`group flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${activeConvId === c.id ? 'bg-violet-700/30 border border-violet-500/30' : 'hover:bg-slate-800'}`}
                onClick={() => loadConversation(c.id)}
              >
                <MessageSquareText className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{c.title || 'Conversa'}</p>
                  <p className="text-xs text-slate-500">{c.total_tokens?.toLocaleString()} tokens</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteConv.mutate(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Nenhuma conversa ainda</p>
            )}
          </div>
        </aside>

        {/* Main chat */}
        <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
          {/* Header */}
          <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">AII Copilot</h1>
              <p className="text-xs text-slate-400">Assistente de operações de TI com acesso à plataforma em tempo real</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-violet-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-white font-semibold text-lg">Como posso ajudar?</h2>
                  <p className="text-slate-400 text-sm mt-1">Pergunte sobre ativos, incidentes, vulnerabilidades, licenças e muito mais.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-300 transition-colors flex items-start gap-2"
                    >
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-violet-400 shrink-0" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.tools_used && msg.tools_used.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.tools_used.map(t => (
                        <span key={t} className="text-xs bg-violet-900/50 text-violet-300 rounded px-1.5 py-0.5 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />{t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.latency_ms && (
                    <p className="text-xs text-slate-500 mt-1">{msg.latency_ms}ms</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span className="text-sm text-slate-400">Processando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-slate-800">
            <div className="flex gap-3 items-end bg-slate-800 rounded-xl border border-slate-700 focus-within:border-violet-500 transition-colors px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pergunte sobre sua infraestrutura... (Enter para enviar)"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none max-h-40"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors shrink-0"
              >
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center">Enter para enviar · Shift+Enter para nova linha · A IA consulta dados em tempo real</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
