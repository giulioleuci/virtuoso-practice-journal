import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Play } from "lucide-react";
import { today } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useItem, useSegmentsByItem } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentHistory } from "@/components/diary/SegmentHistory";

/** History of one section of a library item. */
export default function SegmentPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const itemId = Number(params.id);
  const segmentId = Number(params.segmentId);
  const item = useItem(itemId);
  const segments = useSegmentsByItem(itemId);
  const segment = segments?.find((s) => s.id === segmentId);

  if (item === undefined || segments === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!item || item.deletedAt || !segment) return <EmptyState title={t("segment.notFound")} cta={{ label: t("item.back"), onClick: () => navigate("/library") }} />;

  const bpm = segment.targetBpm ?? item.targetBpm;
  const noteVal = segment.targetBpm !== undefined ? segment.noteVal : item.noteVal;
  return (
    <div className="pb-24">
      <Link to={`/library/item/${itemId}?tab=segments`} className="mb-4 inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("segment.back")}
      </Link>
      <PageHeader
        title={segment.label}

        actions={
          <Button onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { itemId, itemTitle: item.title, itemSubjectId: item.subjectId, segmentIds: [segmentId] } } })}>
            <Play />{t("library.practiceThis")}
          </Button>
        }
      />
      {bpm !== undefined && <p className="mb-6 text-sm text-muted-foreground tabular-nums">{t("library.targetTempo")}: {tempoLabel(noteVal, bpm)} · {t(segment.targetBpm !== undefined ? "segments.specific" : "segments.inherited")}</p>}
      <SegmentHistory itemId={itemId} segmentId={segmentId} targetBpm={bpm} targetNoteVal={noteVal} />
    </div>
  );
}
