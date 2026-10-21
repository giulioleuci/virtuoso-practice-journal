const POINTER = "virtuoso-live-lesson";
const DRAFT = "virtuoso-lesson-draft-";
export const LIVE_LESSON_EVENT = "virtuoso-live-lesson";
const notify = () => window.dispatchEvent(new Event(LIVE_LESSON_EVENT));

/** The `/lessons/live?...` path of the lesson being taken, if any. */
export function readLiveLesson(): string | undefined {
  try { return localStorage.getItem(POINTER) ?? undefined; } catch { return undefined; }
}

export function setLiveLesson(path: string) {
  try { localStorage.setItem(POINTER, path); } catch { /* storage unavailable: the lesson page still works, it just cannot be resumed */ }
  notify();
}

/** Ends the lesson in progress and drops its unsent drafts. */
export function clearLiveLesson() {
  try {
    localStorage.removeItem(POINTER);
    for (const key of Object.keys(localStorage)) if (key.startsWith(DRAFT)) localStorage.removeItem(key);
  } catch { /* nothing to clear */ }
  notify();
}

export function readLessonDraft(scope: string): string {
  try { return localStorage.getItem(DRAFT + scope) ?? ""; } catch { return ""; }
}

export function writeLessonDraft(scope: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(DRAFT + scope, text); else localStorage.removeItem(DRAFT + scope);
  } catch { /* unsent text stays in memory only */ }
  notify();
}
