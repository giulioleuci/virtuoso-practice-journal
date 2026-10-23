import { useMemo } from "react";
import { NotebookText } from "lucide-react";
import type { Session } from "@/domain/entities/session";
import { usePagination } from "@/hooks/usePagination";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pager } from "@/components/shared/Pager";

/** Icon button that opens the paged history of session and section notes of a library item; renders nothing without notes. */
export function NotesHistory({ itemId }: { itemId?: number }) {
  const { t, lang } = useI18n();
  const all = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);
  const sessions = useMemo(
    () => (all ?? []).filter((s) => s.notes || s.marks.some((m) => m.notes)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [all],
  );
  const pager = usePagination(sessions, 5);
  if (!sessions.length) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label={t("practice.notesHistory")}><NotebookText /></Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t("practice.notesHistory")}</DialogTitle></DialogHeader>
        <ul className="divide-y divide-border">
          {pager.pageItems.map((s) => (
            <li key={s.id} className="space-y-1 py-3 first:pt-0">
              <p className="text-sm font-medium tabular-nums">{formatDate(s.date, lang, "weekdayShort")}</p>
              {s.notes && <p className="whitespace-pre-line break-words text-sm">{s.notes}</p>}
              {s.marks.filter((m) => m.notes).map((m, i) => {
                const label = s.snapshot?.segments?.find((sg) => sg.id === String(m.segmentId))?.label;
                return (
                  <p key={m.segmentId ?? i} className="whitespace-pre-line break-words text-xs text-muted-foreground">
                    {label && <span className="font-medium text-foreground">{label}: </span>}{m.notes}
                  </p>
                );
              })}
            </li>
          ))}
        </ul>
        <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />
      </DialogContent>
    </Dialog>
  );
}
