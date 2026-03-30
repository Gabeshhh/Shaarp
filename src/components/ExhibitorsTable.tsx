import { useState } from 'react';
import { Exhibitor } from '@/lib/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Search, Globe, Mail, Phone, Building2, Users } from 'lucide-react';
import Papa from 'papaparse';

interface ExhibitorsTableProps {
  exhibitors: Exhibitor[];
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
];

function CompanyAvatar({ name }: { name: string }) {
  const colorClass = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass} text-white font-semibold text-xs shadow-sm`}>
      {initials || '?'}
    </div>
  );
}

export function ExhibitorsTable({ exhibitors }: ExhibitorsTableProps) {
  const [search, setSearch] = useState('');

  const filteredExhibitors = exhibitors.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const withEmail = exhibitors.filter(e => e.email && e.email !== '').length;
  const withPhone = exhibitors.filter(e => e.phone && e.phone !== '').length;

  const handleExport = () => {
    const formattedData = filteredExhibitors.map(e => ({
      'Nom': e.name,
      'Site Web': e.website || '',
      'Stand': e.booth || '',
      'Email': e.email || '',
      'Téléphone': e.phone || '',
      'LinkedIn': e.linkedin || '',
      'Twitter': e.twitter || '',
    }));
    const csv = Papa.unparse(formattedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contacts_exposants_shaarp.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (exhibitors.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center gap-5 max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 border border-primary/10">
            <Building2 size={28} className="text-primary/40" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Aucune entreprise extraite</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Collez l&apos;URL d&apos;un salon professionnel dans l&apos;assistant pour démarrer l&apos;extraction des contacts.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60 border border-border rounded-lg px-4 py-3 bg-card w-full">
            <div className="flex items-center gap-1.5"><Mail size={12} /> Emails</div>
            <div className="flex items-center gap-1.5"><Phone size={12} /> Téléphones</div>
            <div className="flex items-center gap-1.5"><Globe size={12} /> Sites web</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 gap-3">
      {/* Stats + toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card rounded-xl border border-border px-4 py-3 shadow-sm shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Users size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{exhibitors.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">entreprises</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail size={12} className="text-emerald-500" />
              <span className="font-medium text-foreground">{withEmail}</span> emails
            </span>
            <span className="flex items-center gap-1.5">
              <Phone size={12} className="text-blue-500" />
              <span className="font-medium text-foreground">{withPhone}</span> tél.
            </span>
          </div>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Button onClick={handleExport} size="sm" className="h-8 gap-1.5 text-xs shrink-0">
            <Download size={13} />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl border border-border bg-card overflow-auto shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
              <TableHead className="text-xs font-semibold text-muted-foreground py-3 pl-4">Entreprise</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground py-3 w-24">Stand</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground py-3">Contact</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground py-3 w-24">Réseaux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExhibitors.map((ex, i) => (
              <TableRow key={i} className="group hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0">
                {/* Company */}
                <TableCell className="py-3 pl-4">
                  <div className="flex items-center gap-3">
                    <CompanyAvatar name={ex.name} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{ex.name}</span>
                      {ex.website && ex.website !== '' && (
                        <a
                          href={ex.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary/70 flex items-center gap-1 hover:text-primary transition-colors truncate w-fit"
                        >
                          <Globe size={10} />
                          {ex.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Stand */}
                <TableCell className="py-3">
                  {ex.booth && ex.booth !== '' ? (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                      {ex.booth}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">—</span>
                  )}
                </TableCell>

                {/* Contact */}
                <TableCell className="py-3">
                  <div className="flex flex-col gap-1">
                    {ex.email && ex.email !== '' && (
                      <a
                        href={`mailto:${ex.email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group/link"
                      >
                        <Mail size={11} className="text-emerald-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{ex.email}</span>
                      </a>
                    )}
                    {ex.phone && ex.phone !== '' && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone size={11} className="text-blue-500 shrink-0" />
                        <span>{ex.phone}</span>
                      </div>
                    )}
                    {(!ex.email || ex.email === '') && (!ex.phone || ex.phone === '') && (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </div>
                </TableCell>

                {/* Social */}
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5">
                    {ex.linkedin && ex.linkedin !== '' && (
                      <a
                        href={ex.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        title="LinkedIn"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors text-[10px] font-bold border border-[#0A66C2]/20"
                      >
                        in
                      </a>
                    )}
                    {ex.twitter && ex.twitter !== '' && (
                      <a
                        href={ex.twitter}
                        target="_blank"
                        rel="noreferrer"
                        title="X / Twitter"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/5 text-foreground/60 hover:bg-foreground/10 transition-colors text-[10px] font-bold border border-border"
                      >
                        𝕏
                      </a>
                    )}
                    {(!ex.linkedin || ex.linkedin === '') && (!ex.twitter || ex.twitter === '') && (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredExhibitors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  Aucune entreprise trouvée pour « {search} »
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
