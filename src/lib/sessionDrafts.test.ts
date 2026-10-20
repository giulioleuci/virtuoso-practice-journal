import { expect, it } from "vitest";
import { draftHasContent } from "./sessionDrafts";

const empty = { marks: [], notes: "", clips: [], needHelp: false, helpText: "" };
it("does not count layers and techniques seeded from the plan as something to discard", () => {
  expect(draftHasContent({ ...empty, marks: [{ layers: ["Legato"], techniques: [1] }] })).toBe(false);
  expect(draftHasContent({ ...empty, marks: [{ layers: [], techniques: [], confidence: 3 }] })).toBe(true);
});
