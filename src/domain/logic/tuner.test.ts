import { describe, expect, it } from "vitest";
import { nearestNote } from "./tuner";

describe("chromatic tuner", () => {
  it("finds the nearest note independently of instrument", () => {
    expect(nearestNote(440)).toMatchObject({ noteIndex: 9, octave: 4, cents: 0 });
    expect(nearestNote(261.625565)).toMatchObject({ noteIndex: 0, octave: 4 });
    expect(nearestNote(82.406889)).toMatchObject({ noteIndex: 4, octave: 2 });
  });
  it("reports signed distance in cents", () => {
    expect(nearestNote(440 * 2 ** (23 / 1200))?.cents).toBeCloseTo(23);
    expect(nearestNote(440 * 2 ** (-31 / 1200))?.cents).toBeCloseTo(-31);
  });
  it("switches to the closest semitone", () => {
    expect(nearestNote(440 * 2 ** (70 / 1200))).toMatchObject({ noteIndex: 10, octave: 4 });
    expect(nearestNote(440 * 2 ** (70 / 1200))?.cents).toBeCloseTo(-30);
  });
  it("rejects missing or invalid pitch", () => {
    for (const value of [0, -1, NaN, Infinity]) expect(nearestNote(value)).toBeNull();
  });
});