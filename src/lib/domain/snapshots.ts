import type { LessonRecurrence, LessonSnapshot } from "@/domain/entities/lesson";
import type { SessionSnapshot } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { buildDexieLessonSnapshot } from "@/infrastructure/repositories/dexie/lessonRepository";
import { buildDexieSessionSnapshot } from "@/infrastructure/repositories/dexie/sessionRepository";
export const buildSessionSnapshot = (task: Task): Promise<SessionSnapshot> => buildDexieSessionSnapshot(task);
export const buildLessonSnapshot = (subjectId: number, recurrence?: LessonRecurrence | null, piecePlayedIds: number[] = []): Promise<{ snapshot: LessonSnapshot; piecesPlayedTitles: string[] }> => buildDexieLessonSnapshot(subjectId, recurrence, piecePlayedIds);
