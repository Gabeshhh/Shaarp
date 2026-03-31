'use client';

import { useState, useCallback } from 'react';
import { ExhibitorsTable } from '@/components/ExhibitorsTable';
import { Chat } from '@/components/Chat';
import { ScrapeProgress } from '@/components/ScrapeProgress';
import { ContactsPanel } from '@/components/ContactsPanel';
import { Exhibitor } from '@/lib/schema';
import { Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ProgressState {
  active: boolean;
  status: string;
  current: number;
  total: number;
  phase: 'idle' | 'connecting' | 'collecting' | 'scraping' | 'done' | 'error';
}

export interface LogEntry {
  ts: string;
  type: string;
  message: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressState>({
    active: false, status: '', current: 0, total: 0, phase: 'idle',
  });

  const addLog = useCallback((type: string, message: string) => {
    setLogs(prev => [...prev, { ts: new Date().toISOString(), type, message }]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const hasUrl = /https?:\/\/[^\s"'<>]+/i.test(text);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isNdjson = contentType.includes('application/x-ndjson');
      const isScrapeStream = res.headers.get('X-Scrape-Stream') === 'true' || isNdjson;

      if (isScrapeStream && hasUrl) {
        setExhibitors([]);
        setLogs([]);
        addLog('info', `Démarrage scraping — URL: ${text}`);
        setProgress({ active: true, status: 'Connexion...', current: 0, total: 0, phase: 'connecting' });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const collectedExhibitors: Exhibitor[] = [];

        const statusMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '🔍 Extraction en cours...',
        };
        setMessages(prev => [...prev, statusMsg]);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);

                switch (event.type) {
                  case 'status':
                    addLog('status', event.message || '');
                    setProgress(prev => ({
                      ...prev,
                      status: event.message || '',
                      phase: event.message?.includes('Recherche') ? 'collecting' :
                             event.message?.includes('Deep') ? 'scraping' : prev.phase,
                    }));
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: event.message || '',
                      };
                      return updated;
                    });
                    break;

                  case 'progress':
                    addLog('progress', event.message || `${event.current}/${event.total}`);
                    setProgress(prev => ({
                      ...prev,
                      current: event.current || prev.current,
                      total: event.total || prev.total,
                      status: event.message || prev.status,
                      phase: 'scraping',
                    }));
                    break;

                  case 'exhibitor':
                    if (event.exhibitor) {
                      addLog('exhibitor', `Exposant extrait: ${event.exhibitor.name}`);
                      collectedExhibitors.push(event.exhibitor);
                      setExhibitors([...collectedExhibitors]);
                      setProgress(prev => ({
                        ...prev,
                        current: event.current || collectedExhibitors.length,
                        total: event.total || prev.total,
                        phase: 'scraping',
                      }));
                    }
                    break;

                  case 'done':
                    addLog('done', event.message || `Terminé — ${collectedExhibitors.length} exposants`);
                    setProgress({
                      active: false,
                      status: event.message || 'Terminé',
                      current: event.total || collectedExhibitors.length,
                      total: event.total || collectedExhibitors.length,
                      phase: 'done',
                    });
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: `✅ Extraction terminée — ${collectedExhibitors.length} entreprises récupérées.`,
                      };
                      return updated;
                    });
                    break;

                  case 'error':
                    addLog('error', event.message || 'Erreur inconnue');
                    setProgress(prev => ({ ...prev, active: false, phase: 'error', status: event.message || 'Erreur' }));
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: `❌ ${event.message || 'Une erreur est survenue.'}`,
                      };
                      return updated;
                    });
                    break;
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
      } else {
        const isHtml = contentType.includes('text/html');
        if (!res.ok) {
          const raw = await res.text().catch(() => '');
          const msg = raw && !isHtml ? raw : 'Erreur serveur (réponse non exploitable).';
          const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `❌ ${msg}`,
          };
          setMessages(prev => [...prev, errorMsg]);
          setProgress({ active: false, status: `Erreur HTTP ${res.status}`, current: 0, total: 0, phase: 'error' });
          return;
        }

        if (hasUrl && !isScrapeStream && isHtml) {
          const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '❌ Erreur : la réponse du serveur est invalide. Vérifiez que l’API de scraping est bien activée.',
          };
          setMessages(prev => [...prev, errorMsg]);
          setProgress({ active: false, status: 'Réponse HTML inattendue', current: 0, total: 0, phase: 'error' });
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

const chunk = decoder.decode(value, { stream: true });
assistantContent += chunk;

            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: assistantContent,
              };
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setProgress(prev => ({ ...prev, active: false, phase: 'error' }));
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground font-sans overflow-hidden">
      {progress.active && (
        <ScrapeProgress
          status={progress.status}
          current={progress.current}
          total={progress.total}
          phase={progress.phase}
        />
      )}

      <div className="flex flex-1 overflow-y-auto overflow-x-hidden flex-col lg:flex-row">
        {/* Tableau à gauche */}
        <div className="flex-1 overflow-hidden order-1">
          <ExhibitorsTable exhibitors={exhibitors} logs={logs} />
        </div>

        {/* Contacts au milieu */}
        <div className="order-2">
          <ContactsPanel exhibitors={exhibitors} />
        </div>

        {/* Chat complètement à droite */}
        <div className="flex w-full flex-col h-full overflow-hidden bg-slate-900 border-l border-slate-800 order-3 lg:w-[380px] xl:w-[420px]">
          <div className="flex h-16 items-center px-5 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-lg shadow-blue-500/30">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white tracking-tight leading-none">Shaarp Scraper</h1>
                <p className="text-xs text-slate-500 mt-0.5">Intelligence B2B</p>
              </div>
            </div>
          </div>
          <Chat
            messages={messages}
            sendMessage={sendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
