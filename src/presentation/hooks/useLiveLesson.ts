import { useEffect, useSyncExternalStore } from "react";
import { LIVE_LESSON_EVENT, clearLiveLesson, readLiveLesson } from "@/lib/liveLesson";
import { useLessons, useRecurrences } from "@/presentation/hooks/useEntities";

const subscribe = (cb: () => void) => {
  window.addEventListener(LIVE_LESSON_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(LIVE_LESSON_EVENT, cb); window.removeEventListener("storage", cb); };
};

/** The path of the lesson in progress, kept in sync across tabs. A lesson or teacher deleted since is dropped, never linked to. */
export function useLiveLesson() {
  const path = useSyncExternalStore(subscribe, readLiveLesson);
  const lessons = useLessons();
  const recurrences = useRecurrences();
  const params = new URLSearchParams(path?.split("?")[1]);
  const lessonId = Number(params.get("lesson")), recurrenceId = Number(params.get("recurrence"));
  // undefined = still loading: keep the pointer until the data says otherwise.
  const stale = (!!lessonId && !!lessons && !lessons.some((l) => l.id === lessonId))
    || (!!recurrenceId && !!recurrences && !recurrences.some((r) => r.id === recurrenceId));
  useEffect(() => { if (stale) clearLiveLesson(); }, [stale]);
  return stale ? undefined : path;
}
