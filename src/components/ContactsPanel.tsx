import { useMemo } from 'react';
import { Exhibitor } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Globe, Copy } from 'lucide-react';

interface ContactsPanelProps {
  exhibitors: Exhibitor[];
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
}

function normalizeWebsite(url: string) {
  const v = url.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function splitMulti(value: string) {
  return value
    .split(/[\n,;|]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

export function ContactsPanel({ exhibitors }: ContactsPanelProps) {
  const { emails, phones, websites } = useMemo(() => {
    const emailsRaw: string[] = [];
    const phonesRaw: string[] = [];
    const sitesRaw: string[] = [];

    for (const ex of exhibitors) {
      if (ex.email) emailsRaw.push(...splitMulti(ex.email));
      if (ex.phone) phonesRaw.push(...splitMulti(ex.phone));
      if (ex.website) sitesRaw.push(normalizeWebsite(ex.website));
    }

    return {
      emails: uniq(emailsRaw),
      phones: uniq(phonesRaw),
      websites: uniq(sitesRaw),
    };
  }, [exhibitors]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore (clipboard may be blocked)
    }
  };

  const emailsText = emails.join('\n');
  const phonesText = phones.join('\n');
  const websitesText = websites.join('\n');

  return (
    <div className="h-full w-full lg:w-[380px] xl:w-[420px] shrink-0 border-l border-slate-800 bg-slate-950 text-slate-100">
      <div className="h-full p-4 flex flex-col gap-3 overflow-auto">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Contacts extraits</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Les champs ci-dessous se remplissent automatiquement dès que l’extraction renvoie des données.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-emerald-500" />
              <h3 className="text-xs font-semibold text-slate-100">Emails</h3>
              <span className="text-[11px] text-slate-400">({emails.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 bg-black text-white border-slate-700 hover:bg-slate-900 hover:text-white"
              onClick={() => copy(emailsText)}
              disabled={!emailsText}
            >
              <Copy size={12} />
              Copier
            </Button>
          </div>
          <textarea
            value={emailsText}
            readOnly
            placeholder="Aucun email pour l’instant…"
            className="mt-2 h-40 w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-blue-500" />
              <h3 className="text-xs font-semibold text-slate-100">Téléphones</h3>
              <span className="text-[11px] text-slate-400">({phones.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 bg-black text-white border-slate-700 hover:bg-slate-900 hover:text-white"
              onClick={() => copy(phonesText)}
              disabled={!phonesText}
            >
              <Copy size={12} />
              Copier
            </Button>
          </div>
          <textarea
            value={phonesText}
            readOnly
            placeholder="Aucun numéro pour l’instant…"
            className="mt-2 h-40 w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-primary" />
              <h3 className="text-xs font-semibold text-slate-100">Sites web</h3>
              <span className="text-[11px] text-slate-400">({websites.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 bg-black text-white border-slate-700 hover:bg-slate-900 hover:text-white"
              onClick={() => copy(websitesText)}
              disabled={!websitesText}
            >
              <Copy size={12} />
              Copier
            </Button>
          </div>
          <textarea
            value={websitesText}
            readOnly
            placeholder="Aucun site web pour l’instant…"
            className="mt-2 h-40 w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

