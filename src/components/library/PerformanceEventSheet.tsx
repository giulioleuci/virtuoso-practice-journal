import { useEffect, useMemo, useRef, useState } from "react";
import { usePerformableLibrary, useSubjects } from "@/presentation/hooks/useEntities";
import type { PerformanceEvent, PerformanceKind } from "@/domain/entities/performance";
import { useI18n } from "@/lib/i18n";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { performancesService } from "@/lib/services/performances";
import { today } from "@/lib/date";
import { toast } from "sonner";

const KINDS: PerformanceKind[] = ["concert", "exam", "audition"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: PerformanceEvent | null;
  /** Item ids already in this event's programme. */
  programme?: number[];
}

export function PerformanceEventSheet({ open, onOpenChange, event, programme }: Props) {
  const { t } = useI18n();
  const subjects = useSubjects();
  const pieces = usePerformableLibrary();
  const isEdit = !!event?.id;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PerformanceKind>("concert");
  const [date, setDate] = useState(today());
  const [venue, setVenue] = useState("");
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [itemIds, setItemIds] = useState<number[]>([]);
  // shortcut: retries keep the event ID only while open; atomic event/programme writes need repository work.
  const savedEvent = useRef<{ id?: number; createdAt: number }>({ createdAt: Date.now() });
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    savedEvent.current = { id: event?.id, createdAt: event?.createdAt ?? Date.now() };
    setSearch("");
    setSaveError(undefined);
    setName(event?.name ?? "");
    setKind(event?.kind ?? "concert");
    setDate(event?.date ?? today());
    setVenue(event?.venue ?? "");
    setSubjectId(event?.subjectId);
    setItemIds(programme ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const sortedPieces = useMemo(
    () => (pieces ?? []).filter(piece => `${piece.title} ${piece.composer ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.title.localeCompare(b.title)),
    [pieces, search]
  );

  const canSave = name.trim().length > 0 && !!date;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(undefined);
    let metadataSaved = false;
    try {
    const id = await performancesService.upsertEvent({
      id: savedEvent.current.id,
      name: name.trim(),
      kind,
      date,
      venue: venue.trim() || undefined,
      subjectId,
      createdAt: savedEvent.current.createdAt,
    });
    savedEvent.current.id = id;
    metadataSaved = true;
    await performancesService.setEventItems(id, itemIds);
    toast.success(isEdit ? t("toast.updated") : t("toast.added"));
    onOpenChange(false);
    } catch (error) {
      const message = metadataSaved ? t("performances.programmeSaveFailed") : error instanceof Error && /^(library|performances)\.error\./.test(error.message) ? t(error.message) : t("errors.couldNotSave");
      setSaveError(message);
      toast.error(message);
    }
    finally { setSaving(false); }
  };

  const toggle = (id: number) =>
    setItemIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={value => { if (!saving) onOpenChange(value); }}
      title={isEdit ? t("performances.edit") : t("performances.new")}
      description={t("performances.hint")}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button className="flex-1" disabled={!canSave || saving} onClick={save}>{t("common.save")}</Button>
        </div>
      }
    >
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{t("common.name")}</Label>
        <Input aria-label={t("common.name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("performances.namePlaceholder")} className="bg-card h-12" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">{t("performances.kind")}</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as PerformanceKind)}>
            <SelectTrigger aria-label={t("performances.kind")} className="bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((option) => (
                <SelectItem key={option} value={option}>{t(`performances.kind.${option}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">{t("common.date")}</Label>
          <Input aria-label={t("common.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{t("performances.venue")}</Label>
        <Input aria-label={t("performances.venue")} value={venue} onChange={(e) => setVenue(e.target.value)} className="bg-card" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{t("common.subject")}</Label>
        <Select value={subjectId !== undefined ? String(subjectId) : ""} onValueChange={(value) => setSubjectId(Number(value))}>
          <SelectTrigger aria-label={t("common.subject")} className="bg-card"><SelectValue placeholder={t("tasks.pickSubject")} /></SelectTrigger>
          <SelectContent>
            {(subjects ?? []).map((subject) => (
              <SelectItem key={subject.id} value={String(subject.id)}>{subject.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">
          {t("performances.programme")} · {itemIds.length}
        </Label>
        <Input type="search" aria-label={t("library.searchTitleComposer")} placeholder={t("library.searchTitleComposer")} value={search} onChange={event => setSearch(event.target.value)} />
        {pieces !== undefined && sortedPieces.length === 0 && <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>}
        <ul className="space-y-1">
          {sortedPieces.map((piece) => (
            <li key={piece.id}>
              <label className="paper-card flex items-start gap-3 p-3 min-h-[44px]">
                <Checkbox
                  checked={piece.id !== undefined && itemIds.includes(piece.id)}
                  onCheckedChange={() => piece.id !== undefined && toggle(piece.id)}
                  className="mt-1"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="block font-serif text-base leading-tight break-words">{piece.title}</span>
                  {piece.composer && <span className="block text-xs text-muted-foreground italic">{piece.composer}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </ResponsiveSheet>
  );
}
