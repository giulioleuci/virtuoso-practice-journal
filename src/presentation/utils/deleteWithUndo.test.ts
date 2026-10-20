import { describe, expect, it, vi } from "vitest";
import { deleteWithUndo } from "./deleteWithUndo";

describe("deleteWithUndo", () => {
  it("runs deletion before exposing a restoring toast action", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();

    await deleteWithUndo({ remove, restore, message: "Removed", undoLabel: "Undo", toast, onError: vi.fn() });

    expect(remove).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("Removed", expect.objectContaining({ duration: 6000 }));
    const action = toast.mock.calls[0][1].action;
    expect(action.label).toBe("Undo");
    action.onClick();
    await Promise.resolve();
    expect(restore).toHaveBeenCalledOnce();
  });
  it.each(["remove", "restore"])("reports a failed %s instead of leaving an unhandled rejection", async failure => {
    const errors: unknown[] = [];
    const error = new Error("Disk unavailable");
    let undo: (() => void) | undefined;
    await deleteWithUndo({
      remove: async () => { if (failure === "remove") throw error; },
      restore: async () => { throw error; },
      message: "Removed", undoLabel: "Undo", onError: caught => { errors.push(caught); },
      toast: (_, options) => { undo = options.action.onClick; },
    });
    if (failure === "remove") expect(undo).toBeUndefined();
    else undo!();
    await vi.waitFor(() => expect(errors).toEqual([error]));
  });
});
