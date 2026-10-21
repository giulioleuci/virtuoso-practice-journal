import { useSyncExternalStore } from "react";
import { LIVE_LESSON_EVENT, readLiveLesson } from "@/lib/liveLesson";

const subscribe = (cb: () => void) => {
  window.addEventListener(LIVE_LESSON_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(LIVE_LESSON_EVENT, cb); window.removeEventListener("storage", cb); };
};

/** The path of the lesson in progress, kept in sync across tabs. */
export const useLiveLesson = () => useSyncExternalStore(subscribe, readLiveLesson);
