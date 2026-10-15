import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/domain/entities/task";
import { CarryoverBatchActions } from "./CarryoverBatchActions";

const commands = vi.hoisted(() => ({ carryOver: vi.fn(), skip: vi.fn() }));
vi.mock("@/lib/services", () => ({ tasksService: commands }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const tasks: Task[] = [1, 2].map(id => ({ id, date: "2026-10-10", subjectId: 1, title: `Task ${id}`, plan: [], done: false, createdAt: 1 }));
function Harness({ initial = [] }: { initial?: number[] }) {
  const [ids, setIds] = useState(initial);
  return <CarryoverBatchActions tasks={tasks} todayKey="2026-10-11" selectedIds={ids} onSelectionChange={setIds} />;
}
describe("carryover selection actions", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("reschedules both selected unfinished tasks to today through the existing action", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "diary.moveSelected" }));
    await waitFor(() => expect(commands.carryOver).toHaveBeenCalledTimes(2));
    expect(commands.carryOver).toHaveBeenNthCalledWith(1, tasks[0], "2026-10-11");
    expect(commands.carryOver).toHaveBeenNthCalledWith(2, tasks[1], "2026-10-11");
    expect(commands.skip).not.toHaveBeenCalled();
  });
  it("archives only the selected task without rescheduling or deleting history", async () => {
    render(<Harness initial={[2]} />);
    fireEvent.click(screen.getByRole("button", { name: "diary.archiveSelected" }));
    await waitFor(() => expect(commands.skip).toHaveBeenCalledExactlyOnceWith(2));
    expect(commands.carryOver).not.toHaveBeenCalled();
  });
  it("keeps failed tasks selected for retry without repeating successful ones", async () => {
    commands.carryOver.mockResolvedValueOnce(3).mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce(4);
    render(<Harness initial={[1, 2]} />);
    const move = screen.getByRole("button", { name: "diary.moveSelected" });
    fireEvent.click(move);
    await waitFor(() => expect(move).not.toBeDisabled());
    fireEvent.click(move);
    await waitFor(() => expect(commands.carryOver).toHaveBeenCalledTimes(3));
    expect(commands.carryOver).toHaveBeenNthCalledWith(3, tasks[1], "2026-10-11");
  });
});