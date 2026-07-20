export interface UndoToast {
  (message: string, options: { action: { label: string; onClick: () => void }; duration?: number }): void;
}

/** Runs a UI delete command and exposes its compensating action through a toast. */
export async function deleteWithUndo(options: {
  remove: () => Promise<unknown>;
  restore: () => Promise<unknown>;
  message: string;
  undoLabel: string;
  toast: UndoToast;
  duration?: number;
}): Promise<void> {
  await options.remove();
  options.toast(options.message, {
    action: { label: options.undoLabel, onClick: () => void options.restore() },
    duration: options.duration ?? 6000,
  });
}
