import { useCallback, useEffect, useRef, useState } from "react";
import { readSessionDraft, sessionDraftKey, type SessionDraft } from "@/lib/sessionDrafts";

/** Write at the event boundary: even a recording that finishes during unmount keeps its reference. */
export function useSessionDraft(scope: string, initial: SessionDraft, prefill?: Partial<SessionDraft>) {
  const [restored] = useState(() => readSessionDraft(scope));
  const [draft, setDraft] = useState(() => ({ ...(restored ?? initial), ...prefill }));
  const prefilled = useRef(!!prefill).current;
  const current = useRef(draft);
  const [storageFailed, setStorageFailed] = useState(false);
  const active = useRef(true);
  const update = useCallback((patch: Partial<SessionDraft>) => {
    if (!active.current) return;
    const next = { ...current.current, ...patch };
    current.current = next;
    try {
      localStorage.setItem(sessionDraftKey(scope), JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("virtuoso-session-draft", { detail: scope }));
      setStorageFailed(false);
    }
    catch { setStorageFailed(true); }
    setDraft(next);
  }, [scope]);
  const clear = () => {
    active.current = false;
    try { localStorage.removeItem(sessionDraftKey(scope)); }
    catch { setStorageFailed(true); }
  };
  useEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof StorageEvent ? event.key !== sessionDraftKey(scope) : (event as CustomEvent<string>).detail !== scope) return;
      const saved = readSessionDraft(scope);
      if (saved && active.current) { current.current = saved; setDraft(saved); }
    };
    window.addEventListener("virtuoso-session-draft", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("virtuoso-session-draft", sync); window.removeEventListener("storage", sync); };
  }, [scope]);
  useEffect(() => { if (!restored || prefilled) update({}); }, [restored, prefilled, update]);
  useEffect(() => {
    if (!storageFailed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed]);
  return { draft, update, clear, storageFailed, restored: restored !== undefined };
}
