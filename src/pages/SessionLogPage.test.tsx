/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { applicationCommands } from "@/lib/applicationCommands";
import { audioDb } from "@/infrastructure/dexie/audioDb";
import { today } from "@/lib/date";
import { toast } from "sonner";
import SessionLogPage from "./SessionLogPage";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
let taskId: number;
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear();
  await db.delete(); await db.open();
  await audioDb.clips.clear();
  configurePresentationQueries(dexiePresentationReads);
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  taskId = await db.tasks.add({ subjectId, title: "Sonata exposition", date: today(), plan: [], done: false, createdAt: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function show(free = false) {
  return render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[free ? "/log" : `/log?task=${taskId}`]}><SessionLogPage /></MemoryRouter></I18nContext.Provider>);
}
async function rate() {
  fireEvent.click(within((await screen.findAllByRole("group", { name: t("session.confidenceLabel") })).at(-1)!).getAllByRole("button")[3]);
}

it("records a theory session with custom aspects and methods", async () => {
  const task = (await db.tasks.get(taskId))!;
  await db.subjects.update(task.subjectId, { type: "theory", layers: ["Historical context"] });
  const method = await db.techniques.add({ subjectId: task.subjectId, name: "Oral explanation", createdAt: 1 });
  show();
  fireEvent.click(await screen.findByRole("button", { name: t("session.layers") }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Historical context" }));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Historical context" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: t("session.techniquesPracticed") }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Oral explanation" }));
  fireEvent.keyDown(document, { key: "Escape" });
  await screen.findByRole("button", { name: t("common.removeItem", { label: "Oral explanation" }) });
  await rate();
  fireEvent.click(screen.getByRole("button", { name: t("session.saveSession") }));
  await waitFor(async () => expect((await db.sessions.toArray())[0]?.marks[0]).toMatchObject({ layers: ["Historical context"], techniques: [method] }));
});

it("keeps task context and starts with neutral confidence guidance, with optional ratings collapsed", async () => {
  show();
  await screen.findByText("Sonata exposition");
  expect(screen.queryByText(/Missing:/)).not.toBeInTheDocument();
  expect(screen.getByText(t("rating.mood")).closest("details")).not.toHaveAttribute("open");
  expect(screen.getAllByRole("group", { name: t("session.confidenceLabel") }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: t("session.saveSession") }));
  expect(await screen.findByText(t("rating.missingSummary", { count: 1 }), { exact: false })).toBeInTheDocument();
  expect(await db.sessions.count()).toBe(0);
});

it.each([false, true])("restores notes and confidence after leaving and reopening (free=%s)", async (free) => {
  const view = show(free);
  await rate();
  fireEvent.change(screen.getByRole("textbox", { name: t("session.notes") }), { target: { value: "Keep the left hand soft" } });
  view.unmount();
  show(free);
  await waitFor(() => expect(screen.getByRole("textbox", { name: t("session.notes") })).toHaveValue("Keep the left hand soft"));
  const confidence = within(screen.getAllByRole("group", { name: t("session.confidenceLabel") }).at(-1)!);
  expect(confidence.getAllByRole("button")[3]).toHaveAttribute("aria-pressed", "true");
});

it("retains a draft after a failed save and clears it only after a successful save", async () => {
  const save = vi.spyOn(applicationCommands.sessions.log, "execute").mockRejectedValueOnce(new Error("disk full"));
  show(); await rate();
  fireEvent.change(screen.getByRole("textbox", { name: t("session.notes") }), { target: { value: "Try again" } });
  fireEvent.click(screen.getByRole("button", { name: t("session.saveSession") }));
  await waitFor(() => expect(screen.getByRole("button", { name: t("session.saveSession") })).toBeEnabled());
  cleanup(); show();
  await waitFor(() => expect(screen.getByRole("textbox", { name: t("session.notes") })).toHaveValue("Try again"));
  save.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: t("session.saveSession") }));
  await waitFor(async () => expect(await db.sessions.count()).toBe(1));
  cleanup(); show();
  await waitFor(() => expect(screen.getByRole("textbox", { name: t("session.notes") })).toHaveValue(""));
});

it("restores section ratings after the selected material loads asynchronously", async () => {
  const subjectId = (await db.subjects.toArray())[0].id!;
  const itemId = await db.library.add({ subjectId, kind: "piece", title: "Sonata", createdAt: 1 });
  const segmentId = await db.segments.add({ itemId, label: "Exposition", position: 0, layers: [], createdAt: 1 });
  localStorage.setItem("virtuoso-session-free", JSON.stringify({ subjectId, itemId, notes: "Recovered", clips: [], needHelp: false, helpText: "", marks: [{ segmentId, layers: [], techniques: [], confidence: 4, bpm: 72, noteVal: "quarter" }] }));
  show(true);
  await screen.findByRole("heading", { name: "Exposition" });
  await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(72));
  expect(within(screen.getAllByRole("group", { name: t("session.confidenceLabel") }).at(-1)!).getAllByRole("button")[3]).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("textbox", { name: t("session.notes") })).toHaveValue("Recovered");
});

it("confirms discarding a recovered draft before deleting its local recording", async () => {
  vi.spyOn(applicationCommands.audio, "url").mockResolvedValue(null);
  await audioDb.clips.put({ uid: "take-1", mimeType: "audio/webm", data: new Uint8Array([1, 2]).buffer });
  localStorage.setItem(`virtuoso-session-task-${taskId}-1`, JSON.stringify({ marks: [{ layers: [], techniques: [], confidence: 3 }], notes: "Keep until confirmed", clips: [{ uid: "take-1", mimeType: "audio/webm", durationMs: 1000, title: "First take" }], needHelp: true, helpText: "Which fingering?" }));
  show();
  await screen.findByDisplayValue("First take");
  expect(screen.getByRole("textbox", { name: t("help.questionPlaceholder") })).toHaveValue("Which fingering?");
  fireEvent.click(screen.getByRole("button", { name: t("draft.discard") }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("common.cancel") }));
  expect(await audioDb.clips.count()).toBe(1);
  expect(screen.getByRole("textbox", { name: t("session.notes") })).toHaveValue("Keep until confirmed");
  fireEvent.click(screen.getByRole("button", { name: t("draft.discard") }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("draft.discard") }));
  await waitFor(async () => expect(await audioDb.clips.count()).toBe(0));
  expect(localStorage.getItem(`virtuoso-session-task-${taskId}-1`)).toBeNull();
});

it("offers to discard a draft only once there is something to discard", async () => {
  show();
  await screen.findByText("Sonata exposition");
  expect(screen.queryByRole("button", { name: t("draft.discard") })).not.toBeInTheDocument();
  await rate();
  expect(screen.getByRole("button", { name: t("draft.discard") })).toBeInTheDocument();
});

it("stores an untitled free session as a free session, not as the button label", async () => {
  show(true);
  await rate();
  await waitFor(async () => {
    const save = screen.queryByRole("button", { name: t("session.saveSession") });
    if (save) fireEvent.click(save);
    expect(await db.sessions.count()).toBe(1);
  }, { timeout: 5000 });
  expect((await db.sessions.toArray())[0].snapshot?.taskTitle).toBe(t("logPage.free"));
}, 10000);

it("takes a failed save to the first section still missing its confidence", async () => {
  show();
  await screen.findByText("Sonata exposition");
  fireEvent.click(screen.getByRole("button", { name: t("session.saveSession") }));
  const group = (await screen.findAllByRole("group", { name: t("session.confidenceLabel") })).find((g) => g.getAttribute("aria-invalid") === "true")!;
  await waitFor(() => expect(group).toContainElement(document.activeElement as HTMLElement));
});

it("offers to open the saved session rather than a next task that may not exist", async () => {
  const success = vi.spyOn(toast, "success");
  show(true);
  await rate();
  await waitFor(async () => {
    const save = screen.queryByRole("button", { name: t("session.saveSession") });
    if (save) fireEvent.click(save);
    expect(success).toHaveBeenCalled();
  }, { timeout: 5000 });
  expect(success.mock.calls[0][1]).toMatchObject({ action: { label: t("toast.openSession") } });
}, 10000);

it("updates only expected tempo on initialization and preserves the captured cycle when the draft is saved later", async () => {
  const subjectId=(await db.subjects.toArray())[0].id!;
  const itemId=await db.library.add({ subjectId,kind:"piece",title:"Sonata",createdAt:1 });
  await db.studyRoutines.add({ id:1,subjectId,groups:[],matrix:{},weeksAhead:1,repetitionCap:1,startDate:today(),createdAt:1,tempoRule:{enabled:true,successes:3,minConfidence:5,increase:{kind:"percent",value:3}},tempoRuleRevision:1 });
  await db.tasks.update(taskId,{ itemId,studyRoutineId:1,plan:[{bpm:70,noteVal:"quarter",layers:[],techniques:[]}] });
  localStorage.setItem(`virtuoso-session-task-${taskId}-1`,JSON.stringify({marks:[{bpm:68,noteVal:"quarter",confidence:3,layers:[],techniques:[]}],notes:"Keep this draft",clips:[],needHelp:false,helpText:""}));
  show();
  fireEvent.click(await screen.findByText(t("tempo.title")));
  fireEvent.change(await screen.findByRole("spinbutton",{name:t("tempo.initial")}),{target:{value:"70"}});
  fireEvent.click(screen.getByRole("button",{name:t("tempo.review")}));
  fireEvent.click(await screen.findByRole("button",{name:t("tempo.apply",{count:1})},{timeout:5000}));
  await waitFor(async()=>expect(await db.tempoProgressions.count()).toBe(1));
  await waitFor(()=>expect(JSON.parse(localStorage.getItem(`virtuoso-session-task-${taskId}-1`)!).marks[0].progression?.minConfidence).toBe(5));
  await applicationCommands.tempoProgression.configure({kind:"routine",id:1},{enabled:true,successes:4,minConfidence:4,increase:{kind:"percent",value:3}});
  fireEvent.click(screen.getByRole("button",{name:t("session.saveSession")}));
  await waitFor(async()=>expect(await db.sessions.count()).toBe(1));
  const saved=(await db.sessions.toArray())[0];
  expect(saved.marks[0]).toMatchObject({bpm:68,confidence:3,targetBpm:70,progression:{cycle:1,minConfidence:5}});
  expect(saved.notes).toBe("Keep this draft");
  expect((await db.tempoProgressions.toArray())[0].cycle).toBe(2);
});

it("merges initialization into the latest marks when editing continues during acceptance",async()=>{
  const subjectId=(await db.subjects.toArray())[0].id!;
  const itemId=await db.library.add({subjectId,kind:"piece",title:"Sonata",createdAt:1});
  await db.studyRoutines.add({id:1,subjectId,groups:[],matrix:{},weeksAhead:1,repetitionCap:1,startDate:today(),createdAt:1,tempoRule:{enabled:true,successes:3,minConfidence:5,increase:{kind:"percent",value:3}},tempoRuleRevision:1});
  await db.tasks.update(taskId,{itemId,studyRoutineId:1,plan:[{bpm:70,noteVal:"quarter",layers:[],techniques:[]}]});
  let release=()=>{};const pending=new Promise<void>(resolve=>{release=resolve;});
  const accept=applicationCommands.tempoProgression.accept.bind(applicationCommands.tempoProgression);
  const delayed=vi.spyOn(applicationCommands.tempoProgression,"accept").mockImplementation(async preview=>{await pending;return accept(preview);});
  show();fireEvent.click(await screen.findByText(t("tempo.title")));
  fireEvent.change(await screen.findByRole("spinbutton",{name:t("tempo.initial")}),{target:{value:"70"}});
  fireEvent.click(screen.getByRole("button",{name:t("tempo.review")}));
  fireEvent.click(await screen.findByRole("button",{name:t("tempo.apply",{count:1})},{timeout:5000}));
  await waitFor(()=>expect(delayed).toHaveBeenCalledOnce());
  const inputs=screen.getAllByRole("spinbutton");
  fireEvent.change(inputs.find(input=>input.getAttribute('aria-label')!==t("tempo.initial"))!,{target:{value:"69"}});
  await rate();release();
  await waitFor(()=>expect(JSON.parse(localStorage.getItem(`virtuoso-session-task-${taskId}-1`)!).marks[0].progression?.minConfidence).toBe(5));
  const mark=JSON.parse(localStorage.getItem(`virtuoso-session-task-${taskId}-1`)!).marks[0];
  expect(mark).toMatchObject({bpm:69,confidence:4,targetBpm:70,progression:{cycle:1,minConfidence:5}});
});

it("sends the back link to the practice mode of the task when the log came from it", async () => {
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/log?task=${taskId}&from=practice`]}><SessionLogPage /></MemoryRouter></I18nContext.Provider>);
  const back = await screen.findByRole("link", { name: t("practice.practiceMode") });
  expect(back).toHaveAttribute("href", `/?practice=${taskId}`);
  expect(screen.queryByRole("link", { name: t("nav.today") })).not.toBeInTheDocument();
});

it("keeps the Today back link when the log did not come from practice mode", async () => {
  show();
  expect(await screen.findByRole("link", { name: t("nav.today") })).toHaveAttribute("href", "/");
});
