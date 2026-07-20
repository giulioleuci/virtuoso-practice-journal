import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBackupCommands, useRoutineWizardController, useSessionSubmission } from "./usePresentationControllers";

describe("useSessionSubmission", () => {
  it("resets error, submits through command, and records a failed submission", async () => {
    const command = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("save failed"));
    const { result } = renderHook(() => useSessionSubmission(command));

    await act(async () => { await result.current.submit("first"); });
    expect(command).toHaveBeenCalledWith("first");
    expect(result.current.error).toBeNull();

    await act(async () => { await result.current.submit("second"); });
    expect(result.current.error).toBe("save failed");
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});

describe("useRoutineWizardController", () => {
  it("moves through steps and emits output only after command succeeds", async () => {
    const command = vi.fn().mockResolvedValue(undefined);
    const done = vi.fn();
    const { result } = renderHook(() => useRoutineWizardController(command, done));

    act(() => { result.current.next(); result.current.next(); });
    expect(result.current.step).toBe(3);
    await act(async () => { await result.current.submit({ name: "Morning" }); });
    expect(command).toHaveBeenCalledWith({ name: "Morning" });
    expect(done).toHaveBeenCalledOnce();
    act(() => result.current.back());
    expect(result.current.step).toBe(2);
  });
});

describe("useBackupCommands", () => {
  it("tracks export/import transitions and exposes command failures", async () => {
    const exportBackup = vi.fn().mockResolvedValue(undefined);
    const importBackup = vi.fn().mockRejectedValue(new Error("bad file"));
    const { result } = renderHook(() => useBackupCommands({ exportBackup, importBackup }));

    await act(async () => { await result.current.exportBackup(); });
    expect(result.current.progress).toBe("idle");
    await act(async () => { await result.current.importBackup(); });
    expect(result.current.error).toBe("bad file");
    expect(result.current.progress).toBe("idle");
  });
});
