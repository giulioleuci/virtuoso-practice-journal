/* eslint-disable no-restricted-imports -- Settings integration exercises real persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { applicationCommands } from "@/lib/applicationCommands";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nProvider } from "@/lib/I18nProvider";
import { translate } from "@/lib/i18n";
import Profile from "./Profile";

const t = (key: string) => translate("en", key);
beforeEach(async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.profile.add({ id: "me", name: "Musician", lang: "en", reminderTime: "18:00", reminderFreq: "daily", reminderDays: [1], lateRecoveryDays: 2, graceDay: true, groupByPhase: false, onboarded: true, introSeen: true, createdAt: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const show = () => render(<I18nProvider><Profile /></I18nProvider>);

it("requires replacement confirmation before selecting a backup and reports import failure", async () => {
  const run = vi.spyOn(applicationCommands.backups.import, "execute").mockRejectedValueOnce(new Error("Unsupported backup version: 3"));
  const error = vi.spyOn(toast, "error"); show();
  fireEvent.click(await screen.findByRole("button", { name: t("profile.import") }));
  expect(run).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }));
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: t("profile.import") }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("profile.import") }));
  await waitFor(() => expect(error).toHaveBeenCalledWith(t("errors.invalidFile")));
  expect((await db.profile.get("me"))?.name).toBe("Musician");
});

it("retains a failed name edit and exposes settings names and selected states", async () => {
  show(); fireEvent.click(await screen.findByRole("button", { name: t("profile.editName") }));
  const dialog = screen.getByRole("dialog");
  const input = within(dialog).getByRole("textbox", { name: t("common.name") });
  fireEvent.change(input, { target: { value: "New name" } });
  vi.spyOn(db.profile, "update").mockRejectedValueOnce(new Error("Disk unavailable"));
  fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(t("errors.couldNotSave"));
  expect(input).toHaveValue("New name");
  fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
  await waitFor(async () => expect((await db.profile.get("me"))?.name).toBe("New name"));
  expect(screen.getByRole("combobox", { name: t("onb.lang") })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: t("profile.weekStartsOn") })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: t("profile.reminderEnabled") })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: t("onb.freq.daily") })).toHaveAttribute("aria-pressed", "true");
});
