import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { Subject, SubjectType, Technique } from "@/domain/entities/common";
import { subjectsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { COLOR_KEYS, getSubjectColor, subjectColorCss } from "@/lib/subjectColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { StateNotice } from "@/components/shared/StateNotice";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, ChevronRight, MoreHorizontal, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SubjectsEditor() {
  const { t } = useI18n();
  const subjects = useSubjects();
  const techniques = useTechniques();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listPosition = useRef(0);
  const previousId = useRef(id);
  const heading = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (id !== previousId.current) {
      window.scrollTo(0, id ? 0 : listPosition.current);
      heading.current?.focus({ preventScroll: true });
      previousId.current = id;
    }
  }, [id]);

  const back = () => {
    if (location.state?.fromStudySetup) navigate(-1);
    else navigate("/study-setup", { replace: true });
  };

  if (!subjects || !techniques)
    return (
      <div aria-label={t("common.loading")} role="status" className="space-y-4">
        <div className="paper-skeleton h-20" />
        <div className="paper-skeleton h-40" />
      </div>
    );
  const subject = subjects.find((s) => String(s.id) === id);

  return (
    <div ref={heading} tabIndex={-1} className="min-w-0 pb-8 focus:outline-none [&_h1]:break-words">
      {id ? (
        <>
          <Button
            variant="ghost"
            onClick={back}
            className="mb-4 min-h-11 max-w-full justify-start whitespace-normal px-0 text-left text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {t("nav.studySetup")}
          </Button>
          {subject ? (
            <SubjectDetail
              key={subject.id}
              subject={subject}
              all={subjects}
              techniques={techniques.filter((tech) => tech.subjectId === subject.id)}
              onDeleted={() => navigate("/study-setup", { replace: true })}
            />
          ) : (
            <StateNotice>{t("subjects.notFound")}</StateNotice>
          )}
        </>
      ) : (
        <>
          <PageHeader title={t("nav.studySetup")}  />
          <div className="space-y-8">
            <SubjectGroup
              title={t("onb.subjects.instruments")}
              addLabel={t("onb.subjects.addInstrument")}
              type="instrument"
              items={subjects.filter((s) => s.type === "instrument")}
              techniques={techniques}
              all={subjects}
              onOpen={() => {
                listPosition.current = window.scrollY;
              }}
            />
            <SubjectGroup
              title={t("onb.subjects.theory")}
              addLabel={t("onb.subjects.addTheory")}
              type="theory"
              items={subjects.filter((s) => s.type === "theory")}
              techniques={techniques}
              all={subjects}
              onOpen={() => {
                listPosition.current = window.scrollY;
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SubjectGroup({
  title,
  addLabel,
  type,
  items,
  techniques,
  all,
  onOpen,
}: {
  title: string;
  addLabel: string;
  type: SubjectType;
  items: Subject[];
  techniques: Technique[];
  all: Subject[];
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const submit = async (name: string) => {
    if (all.some((s) => s.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
      throw new Error(t("errors.subjectExists"));
    const id = await subjectsService.create(name, type);
    onOpen();
    navigate(`/study-setup/${id}`, { state: { fromStudySetup: true } });
  };

  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center justify-between font-serif text-2xl font-semibold">
        {title}
        <span className="font-numeric text-sm font-normal text-muted-foreground">{items.length}</span>
      </h2>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((subject) => (
          <li key={subject.id}>
            <Link
              to={`/study-setup/${subject.id}`}
              state={{ fromStudySetup: true }}
              onClick={onOpen}
              className="flex min-h-[76px] items-center gap-3 rounded-md py-4 pr-2 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: subjectColorCss(subject.color, subject.type, subject.customColor),
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-serif text-xl leading-snug">{subject.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t("subjects.layers")}:{" "}
                  {subject.type === "theory" ? THEORY_LAYERS.length : (subject.layers ?? []).length} ·{" "}
                  {t("subjects.techniques")}:{" "}
                  {techniques.filter((tech) => tech.subjectId === subject.id).length}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {!items.length && <p className="py-3 text-sm text-muted-foreground">{t("common.noneDefinedYet")}</p>}
      <div className="mt-3">
        {adding ? (
          <InlineEdit label={addLabel} onSave={submit} onCancel={() => setAdding(false)} adding />
        ) : (
          <Button variant="outline" className="min-h-11 w-full justify-start" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {addLabel}
          </Button>
        )}
      </div>
    </section>
  );
}

function InlineEdit({
  value = "",
  label,
  onSave,
  onCancel,
  adding = false,
}: {
  value?: string;
  label: string;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  adding?: boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3 py-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!draft.trim() || saving) return;
        setSaving(true);
        setError("");
        try {
          await onSave(draft.trim());
        } catch (cause) {
          setError(
            cause instanceof Error && cause.message === t("errors.subjectExists")
              ? cause.message
              : t("errors.couldNotSave")
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <Input
        autoFocus
        aria-label={label}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) onCancel();
        }}
        className="h-12"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || !draft.trim()} className="min-h-11">
          {saving ? t("common.loading") : adding ? t("common.add") : t("common.save")}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel} className="min-h-11">
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function OptionRow({
  label,
  onSave,
  onRemove,
  disabled,
}: {
  label: string;
  onSave: (value: string) => Promise<void>;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  return (
    <li className="border-b border-border">
      {editing ? (
        <InlineEdit
          value={label}
          label={t("common.name")}
          onSave={async (value) => {
            await onSave(value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="min-h-12 min-w-0 flex-1 break-words rounded-md py-3 text-left text-base hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {label}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-11 w-11 shrink-0"
                aria-label={`${t("common.more")}: ${label}`}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="min-h-11 text-destructive focus:text-destructive"
                onSelect={onRemove}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                {t("common.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}

function SubjectDetail({
  subject,
  all,
  techniques,
  onDeleted,
}: {
  subject: Subject;
  all: Subject[];
  techniques: Technique[];
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [editingName, setEditingName] = useState(false);
  const [adding, setAdding] = useState<"layer" | "technique" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const layers =
    subject.type === "theory" ? THEORY_LAYERS.map((l) => t(`library.mastery.${l}`)) : subject.layers ?? [];
  const dotColor = subjectColorCss(subject.color, subject.type, subject.customColor);
  const id = subject.id!;

  const update = async (action: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await action();
    } catch {
      setError(t("errors.couldNotSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={subject.name}

        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={saving}
                className="h-11 w-11"
                aria-label={t("subjects.actions")}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="min-h-11" onSelect={() => setEditingName(true)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                {t("subjects.editSubjectName")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                {t("subjects.deleteSubject")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {editingName && (
        <InlineEdit
          label={t("subjects.editSubjectName")}
          value={subject.name}
          onCancel={() => setEditingName(false)}
          onSave={async (name) => {
            if (all.some((s) => s.id !== id && s.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
              throw new Error(t("errors.subjectExists"));
            await subjectsService.rename(id, name);
            setEditingName(false);
          }}
        />
      )}
      {error && (
        <StateNotice tone="error" className="mb-4">
          {error}
        </StateNotice>
      )}
      <Accordion type="single" collapsible onValueChange={() => setAdding(null)}>
        <AccordionItem value="layers">
          <AccordionTrigger
            className="min-h-[76px] gap-4 text-left hover:no-underline"
            aria-label={`${t("subjects.layers")}: ${layers.length}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base">
                {t("subjects.layers")}{" "}
                <span className="ml-2 font-numeric text-sm text-muted-foreground">{layers.length}</span>
              </span>
              <span className="mt-1 line-clamp-2 break-words text-sm font-normal text-muted-foreground">
                {layers.length ? layers.join(", ") : t("subjects.layersHint")}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {subject.type === "theory" ? t("subjects.theoryLayersFixed") : t("subjects.layersHelp")}
            </p>
            <ul>
              {layers.map((layer) =>
                subject.type === "theory" ? (
                  <li key={layer} className="break-words border-b border-border py-3 text-base">
                    {layer}
                  </li>
                ) : (
                  <OptionRow
                    key={layer}
                    label={layer}
                    disabled={saving}
                    onSave={(name) => subjectsService.renameLayer(id, layer, name)}
                    onRemove={() => void update(() => subjectsService.removeLayer(id, layer))}
                  />
                )
              )}
            </ul>
            {subject.type !== "theory" &&
              (adding === "layer" ? (
                <InlineEdit
                  label={t("subjects.addLayer")}
                  adding
                  onCancel={() => setAdding(null)}
                  onSave={async (name) => {
                    await subjectsService.addLayer(id, name);
                    setAdding(null);
                  }}
                />
              ) : (
                <Button variant="outline" className="min-h-11" onClick={() => setAdding("layer")}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t("subjects.addLayer")}
                </Button>
              ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="techniques">
          <AccordionTrigger
            className="min-h-[76px] gap-4 text-left hover:no-underline"
            aria-label={`${t("subjects.techniques")}: ${techniques.length}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base">
                {t("subjects.techniques")}{" "}
                <span className="ml-2 font-numeric text-sm text-muted-foreground">{techniques.length}</span>
              </span>
              <span className="mt-1 line-clamp-2 break-words text-sm font-normal text-muted-foreground">
                {techniques.length
                  ? techniques.map((tech) => tech.name).join(", ")
                  : t("subjects.techniquesHint")}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {!techniques.length && (
              <p className="text-sm text-muted-foreground">{t("subjects.techniquesHint")}</p>
            )}
            <ul>
              {techniques.map((tech) => (
                <OptionRow
                  key={tech.id}
                  label={tech.name}
                  disabled={saving}
                  onSave={(name) => subjectsService.renameTechnique(tech.id, name)}
                  onRemove={() => void update(() => subjectsService.removeTechnique(tech.id))}
                />
              ))}
            </ul>
            {adding === "technique" ? (
              <InlineEdit
                label={t("subjects.addTechnique")}
                adding
                onCancel={() => setAdding(null)}
                onSave={async (name) => {
                  if (!techniques.some((tech) => tech.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
                    await subjectsService.addTechnique(id, name);
                  setAdding(null);
                }}
              />
            ) : (
              <Button variant="outline" className="min-h-11" onClick={() => setAdding("technique")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {t("subjects.addTechnique")}
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="appearance">
          <AccordionTrigger className="min-h-[76px] gap-4 text-left hover:no-underline">
            <span className="flex flex-1 items-center gap-3 text-base">
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
                aria-hidden
              />
              {t("subjects.appearance")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-1">
            <p className="text-sm text-muted-foreground">{t("subjects.colorLabel")}</p>
            <div className="grid max-w-sm grid-cols-4 gap-3 min-[380px]:grid-cols-5">
              {COLOR_KEYS.map((color) => {
                const selected =
                  !subject.customColor && getSubjectColor(subject.color, subject.type) === color;
                return (
                  <button
                    key={color}
                    disabled={saving}
                    onClick={() => void update(() => subjectsService.setColor(id, color))}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                      selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: `hsl(var(--key-${color}))` }}
                    aria-label={t(`subjects.color.${color}`)}
                    aria-pressed={selected}
                  >
                    {selected && (
                      <Check className="h-5 w-5 text-white" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
            <label className="flex min-h-12 w-fit cursor-pointer items-center gap-3 text-sm">
              <input
                type="color"
                disabled={saving}
                value={subject.customColor ?? "#a0522d"}
                onChange={(e) => void update(() => subjectsService.setCustomColor(id, e.target.value))}
                className="h-12 w-12 cursor-pointer rounded border border-border bg-card p-1"
              />
              {t("subjects.customColor")}
            </label>
            {subject.customColor && (
              <Button
                variant="ghost"
                disabled={saving}
                className="min-h-11"
                onClick={() => void update(() => subjectsService.setCustomColor(id, undefined))}
              >
                {t("common.reset")}
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!saving) setConfirmDelete(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteSubject", { name: subject.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteSubjectDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <Button
              disabled={saving}
              variant="destructive"
              className="min-h-11"
              onClick={() =>
                void update(async () => {
                  await subjectsService.remove(id);
                  toast.success(t("toast.subjectDeleted"));
                  onDeleted();
                })
              }
            >
              {saving ? t("common.loading") : t("common.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
