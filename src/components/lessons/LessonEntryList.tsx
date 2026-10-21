import { useId, useLayoutEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readLessonDraft, writeLessonDraft } from "@/lib/liveLesson";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import { Button } from "@/components/ui/button";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";

/** Text stays in view while typing: grows with its content up to 40% of the screen, Enter submits, Shift+Enter breaks the line. */
function GrowField({ className, onKeyDown, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // field-sizing does the growing where supported; older Android WebViews get the height from scrollHeight.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [props.value]);
  // An edit opens with the caret after the text, where a correction or an addition usually goes.
  useLayoutEffect(() => { const el = ref.current; if (el && props.autoFocus) el.setSelectionRange(el.value.length, el.value.length); }, [props.autoFocus]);
  return (
    <Textarea ref={ref} rows={1} {...props}
      className={cn("min-h-11 max-h-[40vh] resize-none py-2.5 text-base leading-snug caret-primary [field-sizing:content] focus-visible:ring-[3px] md:text-[0.8125rem]", className)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
        onKeyDown?.(e);
      }} />
  );
}

type EntryId = string | number;
// Add and edit keep the text in the field, so the message can say so; a failed delete or undo uses the generic one.
const notSaved = (t: (key: string) => string) => toast.error(t("lessonLive.notSaved"));

/** Add field of a live lesson list: Enter adds the line, unsent text survives a reload under `draftScope`. */
export function LessonEntryField({ label, placeholder, addLabel, draftScope, onAdd }: { label: string; placeholder: string; addLabel: string; draftScope: string; onAdd(text: string): Promise<unknown> }) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(() => readLessonDraft(draftScope));
  const latest = useRef(draft);
  const [added, setAdded] = useState(""); // spoken after each add: the field just empties otherwise

  const type = (value: string) => { latest.current = value; setDraft(value); writeLessonDraft(draftScope, value); };
  const add = async () => {
    const text = latest.current.trim();
    if (!text) return;
    // Cleared before awaiting: a second Enter finds nothing to add, and the next entry can be typed at once.
    latest.current = ""; setDraft("");
    try { await onAdd(text); writeLessonDraft(draftScope, latest.current); setAdded(`${t("toast.added")}: ${text}`); }
    catch { notSaved(t); if (!latest.current.trim()) type(text); }
  };

  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <form className="mt-1.5 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <GrowField id={id} value={draft} onChange={(e) => type(e.target.value)} placeholder={placeholder} enterKeyHint="send" className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={!draft.trim()} aria-label={addLabel}><Plus aria-hidden="true" /></Button>
      </form>
      <p role="status" className="sr-only">{added}</p>
    </div>
  );
}

interface ListProps<T extends { id: EntryId; text: string }> {
  title: string;
  entries: T[];
  onEdit(id: EntryId, text: string): Promise<unknown>;
  onRemove(id: EntryId): Promise<unknown>;
  /** Undo of a removal: gets the removed entry as it was and its position. */
  onRestore(entry: T, index: number): Promise<unknown>;
}

const iconBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground";

/** Entries of a live lesson list (homework or notes), newest first: edit in place, delete with undo. */
export function LessonEntryList<T extends { id: EntryId; text: string }>({ title, entries, onEdit, onRemove, onRestore }: ListProps<T>) {
  const { t } = useI18n();
  const errorId = useId();
  const returnFocus = useRef<EntryId>();
  const [editing, setEditing] = useState<{ id: EntryId; text: string; invalid?: boolean }>();
  const [savingEdit, setSavingEdit] = useState(false);
  const closeEdit = () => { returnFocus.current = editing?.id; setEditing(undefined); };

  const saveEdit = async () => {
    if (!editing || savingEdit) return;
    if (!editing.text.trim()) { setEditing({ ...editing, invalid: true }); return; }
    setSavingEdit(true);
    try { await onEdit(editing.id, editing.text); closeEdit(); } catch { notSaved(t); } finally { setSavingEdit(false); }
  };

  if (!entries.length) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold leading-snug">{title}</h2>
      <ul className="mt-1 divide-y divide-border/60">
        {/* Newest first; index stays the stored position for undo. */}
        {entries.map((entry, index) => [entry, index] as const).reverse().map(([entry, index]) => (
          <li key={entry.id}>
            {editing?.id === entry.id ? (
              <form className="flex flex-wrap gap-2 py-2" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
                <GrowField autoFocus value={editing.text} aria-invalid={editing.invalid} aria-describedby={editing.invalid ? errorId : undefined} aria-label={`${t("common.edit")}: ${entry.text}`} disabled={savingEdit} enterKeyHint="done"
                  onChange={(e) => setEditing({ id: entry.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") closeEdit(); }} className="min-w-0 basis-full aria-[invalid=true]:border-destructive" />
                <Button type="button" variant="outline" className="ml-auto min-h-11" disabled={savingEdit} onClick={closeEdit}>{t("common.cancel")}</Button>
                <Button type="submit" className="min-h-11" disabled={savingEdit}>{t("common.save")}</Button>
                {editing.invalid && <p id={errorId} role="alert" className="basis-full text-xs text-destructive">{t("lessonLive.emptyEdit")}</p>}
              </form>
            ) : (
              <div className="flex items-start gap-1">
                <p className="min-w-0 flex-1 py-2.5 text-sm leading-snug whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.text}</p>
                <button type="button" ref={(el) => { if (el && returnFocus.current === entry.id) { returnFocus.current = undefined; el.focus(); } }} className={iconBtn} aria-label={`${t("common.edit")}: ${entry.text}`} onClick={() => setEditing({ id: entry.id, text: entry.text })}><Pencil className="h-4 w-4" /></button>
                <button type="button" className={`${iconBtn} hover:text-destructive`} aria-label={`${t("common.delete")}: ${entry.text}`}
                  onClick={(e) => {
                    // Focus moves to the neighbouring row instead of falling to the page when this row goes.
                    const row = e.currentTarget.closest("li");
                    (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector("button")?.focus();
                    void deleteWithUndo({ remove: () => onRemove(entry.id), restore: () => onRestore(entry, index), message: t("lessonLive.removed"), undoLabel: t("common.undo"), toast: (message, options) => toast.success(message, options), onError: () => toast.error(t("errors.couldNotSave")) });
                  }}><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
