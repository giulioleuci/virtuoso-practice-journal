import { useCallback, useEffect, useState } from "react";

export interface SheetFormApi<T> {
  values: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (values: T) => void;
  /** Whether the current values pass validation. */
  canSave: boolean;
  errors: string[];
  submitting: boolean;
  submit: () => Promise<void>;
}

export interface SheetFormOptions<T> {
  open: boolean;
  /** Default values; also used to reset the form when the sheet closes. */
  initial: T;
  /** Values to merge over `initial` when the sheet opens. */
  prefill?: () => Partial<T> | undefined;
  /** Re-run prefill while open when this key changes (e.g. the edited record id). */
  resetKey?: unknown;
  /** Validate the current values. Return ok:false (with optional errors) to block submit. */
  validate: (values: T) => { ok: boolean; errors?: string[] };
  /** Persist the values. Errors propagate to the caller's try/catch. */
  onSubmit: (values: T) => Promise<void>;
}

/**
 * Encapsulates the open→prefill, close→reset, validate→save lifecycle shared by
 * the app's bottom sheets. Keeps field state and submit-in-flight tracking in
 * one place so each sheet only declares its fields, validation, and save.
 */
export function useSheetForm<T extends object>(opts: SheetFormOptions<T>): SheetFormApi<T> {
  const { open, initial, prefill, resetKey, validate, onSubmit } = opts;
  const [values, setValues] = useState<T>(initial);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (open) {
      setValues({ ...initial, ...(prefill?.() ?? {}) });
    } else {
      setValues(initial);
    }
    // initial/prefill are derived each render; we intentionally re-seed only on
    // open/resetKey transitions so live edits aren't clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetKey]);

  const { ok, errors } = validate(values);

  const submit = useCallback(async () => {
    if (!ok || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }, [ok, submitting, values, onSubmit]);

  return { values, setField, setValues, canSave: ok, errors: errors ?? [], submitting, submit };
}
