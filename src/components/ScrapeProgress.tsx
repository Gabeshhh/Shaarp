import { Progress } from "@/components/ui/progress";
import { Loader2, Zap, Globe, Database, CheckCircle2, AlertCircle } from "lucide-react";

interface ScrapeProgressProps {
  status: string;
  current: number;
  total: number;
  phase: 'idle' | 'connecting' | 'collecting' | 'scraping' | 'done' | 'error';
}

export function ScrapeProgress({ status, current, total, phase }: ScrapeProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const phaseConfig = {
    connecting: { icon: <Globe size={15} className="text-blue-400" />, label: 'Connexion', color: 'text-blue-400', dot: 'bg-blue-400' },
    collecting:  { icon: <Zap size={15} className="text-amber-400" />, label: 'Collecte', color: 'text-amber-400', dot: 'bg-amber-400' },
    scraping:    { icon: <Database size={15} className="text-violet-400" />, label: 'Extraction', color: 'text-violet-400', dot: 'bg-violet-400' },
    done:        { icon: <CheckCircle2 size={15} className="text-emerald-400" />, label: 'Terminé', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    error:       { icon: <AlertCircle size={15} className="text-red-400" />, label: 'Erreur', color: 'text-red-400', dot: 'bg-red-400' },
    idle:        { icon: <Loader2 size={15} className="animate-spin text-muted-foreground" />, label: 'Initialisation', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  };

  const cfg = phaseConfig[phase] ?? phaseConfig.idle;

  return (
    <div className="bg-card border-b border-border px-5 py-3 flex flex-col gap-2.5 shrink-0 z-10 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            {(phase === 'connecting' || phase === 'collecting' || phase === 'scraping') && (
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping ${cfg.dot}`} />
            )}
            {cfg.icon}
          </div>
          <div>
            <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs">{status}</p>
          </div>
        </div>

        {phase === 'scraping' && total > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{current}<span className="text-muted-foreground font-normal">/{total}</span></p>
            <p className="text-[11px] text-muted-foreground">{percentage}%</p>
          </div>
        )}
        {phase === 'done' && total > 0 && (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-500">{total} contacts</p>
            <p className="text-[11px] text-muted-foreground">récupérés</p>
          </div>
        )}
      </div>

      {(phase === 'scraping' || phase === 'done') && total > 0 && (
        <Progress
          value={percentage}
          className="h-1.5 bg-muted"
        />
      )}
    </div>
  );
}
