import { expect, it } from "vitest";
import { audible, clickRank, stepClick } from "./click";

const pattern = (level: Parameters<typeof audible>[2], bpb: number, beats = 16) => Array.from({ length: beats }, (_, b) => audible(b, bpb, level) ? 1 : 0).join("");
it("plays the ladder patterns", () => {
  expect(pattern(undefined, 4, 4)).toBe("1111");
  expect(pattern("1-3", 4, 8)).toBe("10101010");
  expect(pattern("1-3", 3, 6)).toBe("100100"); // not quadruple: behaves as downbeat only
  expect(pattern("first", 3, 6)).toBe("100100");
  expect(pattern("bar2", 4)).toBe("1000000010000000");
  expect(pattern("bar4", 2)).toBe("1000000010000000");
  expect(pattern("none", 4, 4)).toBe("0000");
});
it("steps up and down the ladder", () => {
  expect(stepClick(undefined, "up")).toBe("first");
  expect(stepClick("1-3", "up")).toBe("first");
  expect(stepClick("bar4", "up")).toBe("none");
  expect(stepClick("none", "up")).toBeUndefined();
  expect(stepClick("first", "down", 4)).toBe("1-3");
  expect(stepClick("first", "down", 3)).toBe("all");
  expect(stepClick("first", "down")).toBe("all");
  expect(stepClick("all", "down")).toBeUndefined();
  expect(clickRank(undefined)).toBe(0);
  expect(clickRank("none")).toBe(5);
});
