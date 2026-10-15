import { describe, expect, it } from "vitest";
import type { Session } from "@/domain/entities/session";
import { RESULT_COLUMNS, SESSION_COLUMNS, csvCell, practiceCsv } from "./exportCsv";

const session = (over: Partial<Session>): Session => ({ id: 1, date: "2026-10-01", marks: [], createdAt: 1, ...over });
const lines = (csv: string) => csv.replace("\uFEFF", "").split("\r\n");

describe("csv export", () => {
  it("escapes quotes, newlines and accents, and guards formulas", () => {
    expect(csvCell('Ré "minore"\nbis')).toBe('"Ré ""minore""\nbis"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+39 bars")).toBe("'+39 bars");
    expect(csvCell("-2 bars")).toBe("'-2 bars");
    expect(csvCell("@here")).toBe("'@here");
    expect(csvCell(["RH", "LH"])).toBe('"[""RH"",""LH""]"');
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(undefined)).toBe("");
  });

  it("writes one row per session and one per studied section, related by session id, within the period", () => {
    const csv = practiceCsv([
      session({
        id: 7, taskId: 3, subjectId: 1, linkType: "item", itemId: 9, notStudied: [12], notes: "ok",
        snapshot: { taskTitle: "Ballade", subjectName: "Piano", segments: [{ id: "11", label: "Intro" }, { id: "12", label: "Coda" }] },
        marks: [{ segmentId: 11, bpm: 72, noteVal: "dotted-quarter", layers: ["RH"], techniques: [4], confidence: 3, mood: 4, focus: 2 }],
      }),
      session({ id: 8, date: "2026-11-01", subjectId: 1, linkType: "free", marks: [{ layers: [], techniques: [], confidence: 5 }] }),
    ], "2026-10-01", "2026-10-31");

    expect(lines(csv.sessions)).toEqual([SESSION_COLUMNS.join(","), "7,3,2026-10-01,1,Piano,item,9,,Ballade,,,[12],ok", ""]);
    expect(lines(csv.results)).toEqual([RESULT_COLUMNS.join(","), '7,segment,11,Intro,72,dotted-quarter,3,4,2,"[""RH""]",[4]', ""]);
    expect(csv.sessions + csv.results).not.toMatch(/duration|minute|blob:|base64|file:/i);
  });

  it("exports the whole history without a period and starts with a UTF-8 BOM", () => {
    const csv = practiceCsv([session({ id: 1 }), session({ id: 2, date: "2020-01-01" })]);
    expect(csv.sessions.startsWith("\uFEFF")).toBe(true);
    expect(lines(csv.sessions)).toHaveLength(4);
  });
});
