import { useEffect, useMemo, useRef, useState } from "react";
import { Book, Pencil, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { LibraryItem } from "@/domain/entities/library";
import { presetRecurrence, resolveWhen, type RepeatPreset, type When } from "@/lib/domain/taskPresets";
import { useI18n } from "@/lib/i18n";
import { tasksService } from "@/lib/services";
import { today } from "@/lib/date";
import { expandTaskRecurrence } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WhenFields, nativeSelect } from "./WhenFields";
import { syncPlan } from "@/domain/logic/plan";
import { useLibrary, useSubjects } from "@/presentation/hooks/useEntities";

/** One-line task entry: type a title, press Enter. Options appear while the form has focus. */
export function QuickAdd({ date, subjectId: filterSubject, onAdded, collapsible = false }: {
  date: string;
  /** Start as a small secondary button; the field opens on click or "N". */
  collapsible?: boolean;
  subjectId?: number | null;
  onAdded: (date: string) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const subjects = useSubjects();
  const library = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<LibraryItem | null>(null);
  const [when, setWhen] = useState<When>("today");
  const [custom, setCustom] = useState(date);
  const [repeat, setRepeat] = useState<RepeatPreset>("none");
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(!collapsible);
  const [busy, setBusy] = useState(false);

  // The viewed day is the default target; today/tomorrow only matter when it is today.
  useEffect(() => {
    setCustom(date);
    setWhen(date === today() ? "today" : "custom");
  }, [date]);

  // "N" focuses the field, unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open && collapsible) inputRef.current?.focus(); }, [open, collapsible]);

  const effectiveSubject = picked?.subjectId ?? subjectId ?? filterSubject ?? subjects?.[0]?.id;
  const suggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (!q || picked) return [];
    return (library ?? []).filter((i) => `${i.title} ${i.composer ?? ""}`.toLowerCase().includes(q)).slice(0, 5);
  }, [library, title, picked]);

  const targetDate = resolveWhen(when, custom);
  const reset = () => { setTitle(""); setPicked(null); setRepeat("none"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text || busy) return;
    if (effectiveSubject === undefined) return void toast.error(t("quick.noSubject"));
    setBusy(true);
    try {
      const recurrence = presetRecurrence(repeat, targetDate);
      await tasksService.create({
        date: targetDate,
        subjectId: effectiveSubject,
        title: text,
        linkType: picked ? "item" : "free",
        itemId: picked?.id,
        plan: syncPlan([], [], picked),
        recurrence,
      });
      const count = recurrence ? expandTaskRecurrence(recurrence).length : 1;
      toast.success(count > 1 ? t("quick.addedMany", { count }) : t("quick.added"));
      reset();
      onAdded(targetDate);
    } catch {
      toast.error(t("quick.failed"));
    } finally {
      setBusy(false);
    }
  };

  const moreOptions = () =>
    navigate("/tasks/new", {
      state: {
        date: targetDate,
        prefill: {
          title: title.trim() || undefined,
          subjectId: effectiveSubject,
          itemId: picked?.id,
          itemTitle: picked?.title,
          itemSubjectId: picked?.subjectId,
        },
      },
    });

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" className="my-2 text-muted-foreground" onClick={() => setOpen(true)} aria-keyshortcuts="n">
        <Plus /> {t("quick.label")}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      aria-label={t("quick.label")}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget) && !title.trim()) { setExpanded(false); if (collapsible) setOpen(false); } }}
      className="my-4"
    >
      <div className="flex items-center gap-2.5 rounded-[14px] border border-border bg-card py-1.5 pl-3.5 pr-1.5 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
        <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); setPicked(null); }}
          required
          maxLength={160}
          aria-keyshortcuts="n"
          aria-label={t("quick.titleLabel")}
          placeholder={t("quick.placeholder")}
          className="min-h-10 min-w-0 flex-1 bg-transparent px-1 text-base caret-primary outline-none placeholder:text-muted-foreground md:text-[0.8125rem]"
        />
        <Button type="submit" disabled={busy || !title.trim()}>{t("common.add")}</Button>
      </div>

      {suggestions.length > 0 && (
        <ul aria-label={t("quick.suggestions")} className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => { setPicked(item); setTitle(item.title); inputRef.current?.focus(); }}
                className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-secondary/40 focus-visible:bg-secondary/40"
              >
                <Book className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                {item.composer && <span className="truncate text-xs text-muted-foreground">{item.composer}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={cn("flex-wrap items-end gap-x-7 gap-y-4 px-1 pt-4", expanded ? "flex" : "hidden")}>
        <WhenFields when={when} custom={custom} repeat={repeat} onWhen={setWhen} onCustom={setCustom} onRepeat={setRepeat} />
        {(subjects?.length ?? 0) > 1 && !picked && (
          <label className="grid min-w-40 gap-1.5 text-xs font-medium">
            {t("common.subject")}
            <select value={effectiveSubject} onChange={(e) => setSubjectId(Number(e.target.value))} className={nativeSelect}>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 max-[699px]:ml-0">
          <button type="button" onClick={moreOptions} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
            <Pencil className="h-3.5 w-3.5" /> {t("quick.moreOptions")}
          </button>
          <Link to="/tasks/bulk" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
            <Book className="h-3.5 w-3.5" /> {t("quick.fromLibrary")}
          </Link>
        </div>
        {repeat !== "none" && <p className="basis-full text-xs text-muted-foreground">{t("quick.repeatHelp")}</p>}
      </div>
    </form>
  );
}
