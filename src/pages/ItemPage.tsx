import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Pencil, Play } from "lucide-react";
import type { Session } from "@/domain/entities/session";
import { meanConfidence, topBpm } from "@/domain/logic/sessionMetrics";
import { sessionLabel, tempoLabel } from "@/lib/format";
import { formatDate, today } from "@/lib/date";
import { subjectColorCss } from "@/lib/subjectColors";
import { useI18n } from "@/lib/i18n";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useAllCollections, useCollectionLinksByItem, useItem, useSegmentsByItem, useSubjects, useTechniques } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ItemAnalysis } from "@/components/library/ItemAnalysis";
import { ItemQuestions } from "@/components/library/ItemHelpSheet";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";
import { BpmTimelineChart } from "@/components/library/BpmTimelineChart";

const TABS = ["overview", "segments", "sessions", "analysis", "questions"] as const;
type Tab = (typeof TABS)[number];

/** One library item: overview, sections, sessions, analysis and teacher questions on a single page. */
export default function ItemPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const itemId = Number(id);
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x === params.get("tab")) ?? "overview";

  const item = useItem(itemId);
  const segments = useSegmentsByItem(itemId) ?? [];
  const subjects = useSubjects();
  const techniques = useTechniques();
  const collections = useAllCollections();
  const links = useCollectionLinksByItem(itemId);
  const sessions = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);
  const help = usePresentationRead<{ id?: number; resolved?: boolean }[]>("helpRequests.item", [itemId]);

  const [editOpen, setEditOpen] = useState(false);

  const sorted = useMemo(() => [...(sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [sessions]);
  const last = sorted[0];
  const lastTempo = sorted.find(s => s.marks.some(m => m.bpm))?.marks;

  if (item === undefined || sessions === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!item || item.deletedAt) return <EmptyState title={t("item.notFound")} cta={{ label: t("item.back"), onClick: () => navigate("/library") }} />;

  const subject = subjects?.find((s) => s.id === item.subjectId);
  const openQuestions = (help ?? []).filter((h) => !h.resolved).length;
  const itemCollections = (links ?? []).map((l) => collections?.find((c) => c.id === l.collectionId)).filter((c) => !!c);
  const techNames = (item.techniqueIds ?? []).map((tid) => techniques?.find((x) => x.id === tid)?.name).filter(Boolean) as string[];
  const study = (segmentIds?: number[]) =>
    navigate("/tasks/new", { state: { date: today(), prefill: { itemId: item.id, itemTitle: item.title, itemSubjectId: item.subjectId, segmentIds } } });
  const setTab = (next: Tab) => setParams(next === "overview" ? {} : { tab: next }, { replace: true });
  const isTheory = item.kind === "theory";

  const sessionRows = (list: Session[]) => (
    <ul className="divide-y divide-border border-t border-border">
      {list.map((s) => (
        <li key={s.id}>
          <Link to={`/sessions/${s.id}`} className="flex w-full items-start gap-3 py-3 text-left hover:bg-secondary/30">
            <span className="w-10 shrink-0 text-center font-serif text-xl leading-none tabular-nums">{meanConfidence(s.marks)?.toFixed(1).replace(/\.0$/, "") ?? "—"}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-x-3 text-sm font-medium">
                {formatDate(s.date, lang, "weekdayShort")}
                <span className="flex gap-3 text-xs font-normal tabular-nums text-muted-foreground">
                  {sessionLabel(s.marks)}
                </span>
              </span>
              {s.notes && <span className="line-clamp-2 text-xs text-muted-foreground">{s.notes}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const studyBtn = <Button onClick={() => study()}><Play />{t("library.practiceThis")}</Button>;

  return (
    <div className="pb-24">
      <Link to={`/library`} className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("item.back")}
      </Link>
      <PageHeader
        title={item.title}

        actions={<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />{t("common.edit")}</Button>}
      />

      <Tabs value={tab} onValueChange={value => setTab(value as Tab)}>
      <TabsList aria-label={item.title} className="mb-6 flex h-auto flex-wrap justify-start gap-x-4 rounded-none border-b border-border bg-transparent p-0">
        {TABS.map((id2) => {
          const count = id2 === "segments" ? segments.length : id2 === "sessions" ? sorted.length : id2 === "questions" ? openQuestions : 0;
          return (
            <TabsTrigger key={id2} value={id2}
              className="-mb-px min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
              {t(`item.tab.${id2}`)}{count > 0 && <span className="ml-1.5 font-numeric text-xs tabular-nums">{count}</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={tab}>

      {tab === "overview" && (
        <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
          <div className="min-w-0 space-y-8">
            <section>
              <SectionHeader title={t("item.studyTitle")} action={studyBtn} />
              <dl className="flex flex-wrap gap-x-10 gap-y-3">
                <div><dt className="text-xs text-muted-foreground">{t("item.sessionsStat")}</dt><dd className="font-numeric text-xl tabular-nums">{sorted.length}</dd></div>
                {!isTheory && <div><dt className="text-xs text-muted-foreground">{t("item.lastTempo")}</dt><dd className="font-numeric text-xl tabular-nums">{lastTempo ? sessionLabel(lastTempo.map(mark => ({ ...mark, confidence: undefined }))) : "—"}{item.targetBpm ? <span className="ml-2 text-sm text-muted-foreground">{t("library.targetTempo")}: {tempoLabel(item.noteVal, item.targetBpm)}</span> : null}</dd></div>}
                <div><dt className="text-xs text-muted-foreground">{t("item.lastSession")}</dt><dd className="font-numeric text-xl tabular-nums">{last ? formatDate(last.date, lang, "dayMonth") : "—"}</dd></div>
              </dl>
            </section>

            {!isTheory && sorted.some((s) => topBpm(s.marks)) && (
              <section>
                <SectionHeader title={t("item.tempoTrend")} action={<button type="button" onClick={() => setTab("analysis")} className="min-h-11 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">{t("item.fullAnalysis")}</button>} />
                <BpmTimelineChart sessions={sorted} targetBpm={item.targetBpm} targetNoteVal={item.noteVal} />
              </section>
            )}

            <section>
              <SectionHeader title={t("item.recentSessions")} action={<button type="button" onClick={() => setTab("sessions")} className="min-h-11 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">{t("item.allSessions")}</button>} />
              {sorted.length ? sessionRows(sorted.slice(0, 3)) : <EmptyState title={t("item.noSessions")} hint={t("item.noSessionsHint")} />}
            </section>
          </div>

          <aside className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("item.context")}</h3>
              <p className="text-xs text-muted-foreground">{t("item.collections")}</p>
              <p className="mb-3 text-sm">
                {itemCollections.length ? itemCollections.map((c) => <Link key={c!.id} to={`/library/collections/${c!.id}`} className="mr-3 inline-block font-medium text-primary hover:underline underline-offset-4">{c!.name}</Link>) : t("item.noCollection")}
              </p>
              <p className="text-xs text-muted-foreground">{t("item.techniques")}</p>
              <p className="mb-3 text-sm">{techNames.length ? techNames.join(", ") : t("item.noTechniques")}</p>
              {item.notes && <><p className="text-xs text-muted-foreground">{t("library.stableNotes")}</p><p className="whitespace-pre-line break-words text-sm">{item.notes}</p></>}

            </section>
          </aside>
        </div>
      )}

      {tab === "segments" && (
        <section>
          <SectionHeader title={t("item.segmentsTitle")} action={<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil />{t("item.manageSegments")}</Button>} />
          {segments.length === 0 ? (
            <EmptyState title={t("item.noSegments")} hint={t("item.noSegmentsHint")} cta={{ label: t("item.manageSegments"), onClick: () => setEditOpen(true) }} />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {segments.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
                  <div className="min-w-full flex-1 min-[700px]:min-w-0">
                    <h3 className="text-base font-medium [overflow-wrap:anywhere]">{s.label}</h3>
                    {s.barStart !== undefined && <p className="text-xs text-muted-foreground">{t("segments.bars", { start: s.barStart, end: s.barEnd! })}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground [overflow-wrap:anywhere]">
                      {(s.targetBpm ?? item.targetBpm) && <span>{tempoLabel(s.targetBpm !== undefined ? s.noteVal : item.noteVal, (s.targetBpm ?? item.targetBpm)!)} · {t(s.targetBpm !== undefined ? "segments.specific" : "segments.inherited")}</span>}
                      {s.notes && <span>{s.notes}</span>}
                      {s.layers.map((l) => <span key={l}>{l}</span>)}
                      {(s.techniqueIds ?? []).map((tid) => <span key={tid}>{techniques?.find((x) => x.id === tid)?.name}</span>)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="min-h-11"><Link to={`/library/item/${itemId}/segment/${s.id}`}>{t("item.segmentHistory")}</Link></Button>
                  <Button size="sm" className="min-h-11" onClick={() => study([s.id])}><Play />{t("library.practiceThis")}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "sessions" && (
        <section>
          <SectionHeader title={t("item.pathTitle")} action={studyBtn} />
          {sorted.length ? sessionRows(sorted) : <EmptyState title={t("item.noSessions")} hint={t("item.noSessionsHint")} cta={{ label: t("library.practiceThis"), onClick: () => study() }} />}
        </section>
      )}

      {tab === "analysis" && <ItemAnalysis itemId={itemId} />}
      {tab === "questions" && <ItemQuestions itemId={itemId} />}
      </TabsContent>
      </Tabs>

      <NewLibraryItemSheet open={editOpen} onOpenChange={setEditOpen} kind={item.kind} item={item} />
    </div>
  );
}
