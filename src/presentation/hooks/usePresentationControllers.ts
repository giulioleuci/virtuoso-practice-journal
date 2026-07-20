import { useCallback, useState } from "react";

type Command<Input> = (input: Input) => Promise<void>;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Presentation-only async command state. Commands are injected by each feature. */
export function useSessionSubmission<Input>(command: Command<Input>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (input: Input) => {
    setSubmitting(true);
    setError(null);
    try {
      await command(input);
      return true;
    } catch (error) {
      setError(messageOf(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [command]);

  const reset = useCallback(() => setError(null), []);
  return { submitting, error, submit, reset };
}

export function useRoutineWizardController<Output>(command: Command<Output>, onCreated: () => void) {
  const [step, setStep] = useState(1);
  const submission = useSessionSubmission(command);
  const next = useCallback(() => setStep((current) => Math.min(3, current + 1)), []);
  const back = useCallback(() => setStep((current) => Math.max(1, current - 1)), []);
  const submit = useCallback(async (output: Output) => {
    if (await submission.submit(output)) onCreated();
  }, [onCreated, submission]);
  return { step, setStep, next, back, ...submission, submit };
}

export function useBackupCommands(commands: { exportBackup: () => Promise<unknown>; importBackup: () => Promise<unknown> }) {
  const [progress, setProgress] = useState<"idle" | "exporting" | "importing">("idle");
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (progress: "exporting" | "importing", command: () => Promise<unknown>) => {
    setProgress(progress);
    setError(null);
    try {
      return { ok: true as const, value: await command() };
    } catch (error) {
      const message = messageOf(error);
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setProgress("idle");
    }
  }, []);
  return {
    progress,
    error,
    exportBackup: useCallback(() => run("exporting", commands.exportBackup), [commands.exportBackup, run]),
    importBackup: useCallback(() => run("importing", commands.importBackup), [commands.importBackup, run]),
  };
}
