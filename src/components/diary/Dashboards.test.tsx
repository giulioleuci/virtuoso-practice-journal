import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "@/domain/entities/session";
import { I18nContext, translate } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { ProgressDashboard } from "./ProgressDashboard";
import { StatsDashboard } from "./StatsDashboard";

const reads = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/presentation/hooks/usePresentationQuery", () => ({ usePresentationRead: (operation: string) => reads.get(operation) ?? [] }));
const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const show = (node: React.ReactNode) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter>{node}</MemoryRouter></I18nContext.Provider>);
const session = (id: number, date: string, bpm = 100): Session => ({ id, date, createdAt: id, marks: [{ bpm, targetBpm: 100, layers: [], techniques: [] }] });
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); reads.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shows the latest zero goal rate instead of an older successful week", () => {
  reads.set("sessions.all", [session(1, "2026-10-12"), session(2, "2026-10-19", 90)]);
  show(<ProgressDashboard to="2026-10-20" />);
  expect(screen.getByText(t("progress.goals")).nextElementSibling).toHaveTextContent("0%");
});

it("counts this calendar week and exposes the complete twelve-week daily history", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T12:00:00"));
  show(<StatsDashboard sessions={[session(1, "2026-10-18"), session(2, "2026-10-20")]} />);
  expect(screen.getByText(t("stats.thisWeek")).previousElementSibling).toHaveTextContent("1");
  const summary = screen.getByText(`${t("analysis.dataTable")}: ${t("stats.last12Weeks")}`);
  const details = summary.closest("details")!; details.open = true; fireEvent(details, new Event("toggle"));
  const table = await screen.findByRole("table", { name: t("stats.last12Weeks") });
  expect(within(table).getAllByRole("row")).toHaveLength(85);
  expect(within(table).getByRole("link", { name: formatDate("2026-10-20", "en", "medium") })).toHaveAttribute("href", "/history?from=2026-10-20&to=2026-10-20");
});

it("uses the final ninety days of a long selected range", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T12:00:00"));
  show(<StatsDashboard from="2023-01-01" to="2026-10-20" sessions={[session(1, "2023-01-01"), session(2, "2026-10-20")]} />);
  const summary = screen.getByText(new RegExp(`^${t("analysis.dataTable")}:`));
  const details = summary.closest("details")!; details.open = true; fireEvent(details, new Event("toggle"));
  const rows = within(await screen.findByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(91);
  expect(rows[1]).toHaveTextContent(formatDate("2026-07-23", "en", "medium"));
  expect(rows.at(-1)).toHaveTextContent(formatDate("2026-10-20", "en", "medium"));
});
