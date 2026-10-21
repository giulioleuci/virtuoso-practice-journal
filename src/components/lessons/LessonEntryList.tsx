import { useId, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { readLessonDraft, writeLessonDraft } from "@/lib/liveLesson";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EntryId = string | number;
interface Props<T extends { id: EntryId; text: string }> {
  title: string;
  placeholder: string;
  addLabel: string;
  entries: T[];
  /** Unsent text survives a reload under this key. */
  draftScope: string;
  onAdd(text: string): Promise<unknown>;
  onEdit(id: EntryId, text: string): Promise<unknown>;
  onRemove(id: EntryId): Promise<unknown>;
  /** Undo of a removal: gets the removed entry as it was and its position. */
  onRestore(entry: T, index: number): Promise<unknown>;
}

const iconBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground";

/** One list of a live lesson (homework or notes): add with Enter, edit in place, delete with undo. */
export function LessonEntryList<T extends { id: EntryId; text: string }>({ title, placeholder, addLabel, entries, draftScope, onAdd, onEdit, onRemove, onRestore }: Props<T>) {
  const { t } = useI18n();
  const errorId = useId();
  const returnFocus = useRef<EntryId>();
  const [draft, setDraft] = useState(() => readLessonDraft(draftScope));
  const latest = useRef(draft);
  const [editing, setEditing] = useState<{ id: EntryId; text: string; invalid?: boolean }>();
  const [savingEdit, setSavingEdit] = useState(false);
  const failed = () => toast.error(t("errors.couldNotSave"));
  const closeEdit = () => { returnFocus.current = editing?.id; setEditing(undefined); };

  const type = (value: string) => { latest.current = value; setDraft(value); writeLessonDraft(draftScope, value); };
  const add = async () => {
    const text = latest.current.trim();
    if (!text) return;
    // Cleared before awaiting: a second Enter finds nothing to add, and the next entry can be typed at once.
    latest.current = ""; setDraft("");
    try { await onAdd(text); writeLessonDraft(draftScope, latest.current); }
    catch { failed(); if (!latest.current.trim()) type(text); }
  };
  const saveEdit = async () => {
    if (!editing || savingEdit) return;
    if (!editing.text.trim()) { setEditing({ ...editing, invalid: true }); return; }
    setSavingEdit(true);
    try { await onEdit(editing.id, editing.text); closeEdit(); } catch { failed(); } finally { setSavingEdit(false); }
  };

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border/60">
        {entries.map((entry, index) => (
          <li key={entry.id} className="py-1">
            {editing?.id === entry.id ? (
              <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
                <Input autoFocus value={editing.text} aria-invalid={editing.invalid} aria-describedby={editing.invalid ? errorId : undefined} aria-label={`${t("common.edit")}: ${entry.text}`} disabled={savingEdit}
                  onChange={(e) => setEditing({ id: entry.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") closeEdit(); }} className="min-h-11 min-w-0 flex-1 aria-[invalid=true]:border-destructive" />
                <Button type="button" variant="outline" className="min-h-11" disabled={savingEdit} onClick={closeEdit}>{t("common.cancel")}</Button>
                <Button type="submit" className="min-h-11" disabled={savingEdit}>{t("common.save")}</Button>
                {editing.invalid && <p id={errorId} role="alert" className="basis-full text-xs text-destructive">{t("lessonLive.emptyEdit")}</p>}
              </form>
            ) : (
              <div className="flex items-start gap-1">
                <p className="min-w-0 flex-1 py-3 text-sm leading-snug whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.text}</p>
                <button type="button" ref={(el) => { if (el && returnFocus.current === entry.id) { returnFocus.current = undefined; el.focus(); } }} className={iconBtn} aria-label={`${t("common.edit")}: ${entry.text}`} onClick={() => setEditing({ id: entry.id, text: entry.text })}><Pencil className="h-4 w-4" /></button>
                <button type="button" className={`${iconBtn} hover:text-destructive`} aria-label={`${t("common.delete")}: ${entry.text}`}
                  onClick={() => void deleteWithUndo({ remove: () => onRemove(entry.id), restore: () => onRestore(entry, index), message: t("lessonLive.removed"), undoLabel: t("common.undo"), toast: (message, options) => toast.success(message, options), onError: failed })}><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Input value={draft} onChange={(e) => type(e.target.value)} placeholder={placeholder} aria-label={addLabel} enterKeyHint="send" className="min-h-11 min-w-0 flex-1" />
        <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={!draft.trim()} aria-label={addLabel}><Plus aria-hidden="true" /></Button>
      </form>
    </section>
  );
}
