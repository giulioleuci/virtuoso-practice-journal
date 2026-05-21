import { useEffect, useRef, useState } from "react";

/**
 * Auto-saves form state to sessionStorage and offers resume/discard UI.
 * Draft is cleared when the form is submitted or explicitly discarded.
 */
export function useFormDraft<T extends object>(key: string, initial: T) {
  const draftKey = `virtuoso-draft-${key}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [resumed, setResumed] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setHasDraft(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [draftKey]);

  const saveDraft = (state: T) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(state));
      } catch {
        // sessionStorage might be unavailable
      }
    }, 500);
  };

  const clearDraft = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Ignore
    }
    setHasDraft(false);
    setResumed(false);
  };

  const getDraft = (): T | null => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const resumeDraft = (): T | null => {
    const draft = getDraft();
    if (draft) {
      setHasDraft(false);
      setResumed(true);
    }
    return draft;
  };

  const discardDraft = () => {
    clearDraft();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { hasDraft, resumed, saveDraft, clearDraft, getDraft, resumeDraft, discardDraft };
}
