import { describe, expect, it, vi } from "vitest";
import { deleteWithUndo } from "./deleteWithUndo";

describe("deleteWithUndo", () => {
  it("runs deletion before exposing a restoring toast action", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();

    await deleteWithUndo({ remove, restore, message: "Removed", undoLabel: "Undo", toast });

    expect(remove).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("Removed", expect.objectContaining({ duration: 6000 }));
    const action = toast.mock.calls[0][1].action;
    expect(action.label).toBe("Undo");
    action.onClick();
    await Promise.resolve();
    expect(restore).toHaveBeenCalledOnce();
  });
});
