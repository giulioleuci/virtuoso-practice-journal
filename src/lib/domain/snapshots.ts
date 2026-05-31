/** Immutable context snapshots for sessions and lessons.
 *
 * These read from the DB to denormalize context at save time, so historical
 * records render faithfully even after the source entities change.
 */
import { db, type LessonRecurrence, type LessonSnapshot, type SessionSnapshot, type Task } from "@/lib/db";

/** Build an immutable snapshot of context needed to render a Session. */
export async function buildSessionSnapshot(task: Task): Promise<SessionSnapshot> {
  const [subject, item, segs, techs, collection] = await Promise.all([
    db.subjects.get(task.subjectId),
    task.itemId ? db.library.get(task.itemId) : Promise.resolve(undefined),
    task.segmentIds?.length
      ? db.segments.where("id").anyOf(task.segmentIds).toArray()
      : Promise.resolve([]),
    task.techniqueIds?.length
      ? db.techniques.where("id").anyOf(task.techniqueIds).toArray()
      : Promise.resolve([]),
    task.collectionId ? db.collections.get(task.collectionId) : Promise.resolve(undefined),
  ]);
  return {
    taskTitle: task.title,
    subjectName: subject?.name ?? "—",
    itemTitle: item?.title,
    itemComposer: item?.composer,
    segments: segs.length ? segs.map((s) => ({ id: String(s.id), label: s.label })) : undefined,
    collectionName: collection?.name,
    targetBpm: task.targetBpm,
    noteVal: task.noteVal,
    layers: task.layers,
    techniqueNames: techs.map((t) => t.name),
  };
}

/** Build an immutable snapshot of context needed to render a Lesson. */
export async function buildLessonSnapshot(
  subjectId: number,
  recurrence?: LessonRecurrence | null,
  piecePlayedIds: number[] = [],
): Promise<{ snapshot: LessonSnapshot; piecesPlayedTitles: string[] }> {
  const [subject, pieces] = await Promise.all([
    db.subjects.get(subjectId),
    piecePlayedIds.length ? db.library.where("id").anyOf(piecePlayedIds).toArray() : Promise.resolve([]),
  ]);
  return {
    snapshot: {
      subjectName: subject?.name ?? "—",
      teacher: recurrence?.teacher,
      frequency: recurrence?.frequency,
    },
    piecesPlayedTitles: pieces.map((p) => p.title),
  };
}
