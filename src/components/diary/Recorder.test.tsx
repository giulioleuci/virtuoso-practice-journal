import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { applicationCommands } from "@/lib/applicationCommands";
import { readSessionDraft } from "@/lib/sessionDrafts";
import { useSessionDraft } from "@/presentation/hooks/useSessionDraft";
import { I18nContext, translate } from "@/lib/i18n";
import { Recorder } from "./Recorder";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("stops recording on exit and preserves the finished clip in the session draft", async () => {
  vi.spyOn(applicationCommands.audio, "start").mockResolvedValue();
  vi.spyOn(applicationCommands.audio, "stop").mockResolvedValue({ uid: "interrupted-take", mimeType: "audio/webm", durationMs: 1000 });
  const t = (key: string) => translate("en", key);
  function Form() {
    const { draft, update } = useSessionDraft("free", { marks: [], clips: [], notes: "", needHelp: false, helpText: "" });
    return <Recorder sections={[]} onClip={(clip) => update({ clips: [...draft.clips, clip] })} />;
  }
  const view = render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><Form /></I18nContext.Provider>);
  fireEvent.click(screen.getByRole("button", { name: t("audio.record") }));
  await screen.findByRole("button", { name: t("audio.stop") });
  view.unmount();
  await waitFor(() => expect(readSessionDraft("free")?.clips).toEqual([{ uid: "interrupted-take", mimeType: "audio/webm", durationMs: 1000 }]));
});

it("keeps a take linked to the section where recording began", async () => {
  vi.spyOn(applicationCommands.audio, "start").mockResolvedValue();
  vi.spyOn(applicationCommands.audio, "stop").mockResolvedValue({ uid: "section-take", mimeType: "audio/webm", durationMs: 1000 });
  const t = (key: string) => translate("en", key);
  function Form() {
    const [segmentId, setSegmentId] = useState(1);
    const { update } = useSessionDraft("section", { marks: [], clips: [], notes: "", needHelp: false, helpText: "" });
    return <><button onClick={() => setSegmentId(2)}>Next section</button><Recorder sections={[]} compact segmentId={segmentId} onClip={(clip) => update({ clips: [clip] })} /></>;
  }
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><Form /></I18nContext.Provider>);
  fireEvent.click(screen.getByRole("button", { name: t("audio.record") }));
  await screen.findByRole("button", { name: t("audio.stop") });
  fireEvent.click(screen.getByRole("button", { name: "Next section" }));
  fireEvent.click(screen.getByRole("button", { name: t("audio.stop") }));
  await waitFor(() => expect(readSessionDraft("section")?.clips[0].segmentId).toBe(1));
});
