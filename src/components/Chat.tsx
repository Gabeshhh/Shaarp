import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, Loader2, Link2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  messages: Message[];
  sendMessage: (text: string) => void;
  isLoading: boolean;
}

export function Chat({ messages, sendMessage, isLoading }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInputValue('');
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="flex-1 h-full">
        <div className="flex flex-col gap-3 p-4 pb-6">
          {messages.length === 0 && (
            <div className="flex flex-col gap-4 pt-8 px-2">
              <div className="flex flex-col items-center text-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <Bot size={22} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-medium text-sm">Assistant d&apos;extraction</p>
                  <p className="text-slate-500 text-xs mt-1">Collez l&apos;URL d&apos;un salon professionnel</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  'Extraction des contacts exposants',
                  'Emails, téléphones, réseaux sociaux',
                  'Export CSV en un clic',
                ].map((tip, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-xs text-slate-400">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/20">
                  <Bot size={14} className="text-blue-400" />
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.content && (
                  <div className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                  }`}>
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <div className="flex gap-2.5 justify-start">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/20">
                <Loader2 size={14} className="animate-spin text-blue-400" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-400">
                Analyse en cours…
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="https://salon-exemple.com/exposants"
              className="pl-8 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 h-9"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || inputValue.length === 0}
            className="h-9 w-9 bg-blue-600 hover:bg-blue-500 text-white border-0 shrink-0"
          >
            <Send size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
}
