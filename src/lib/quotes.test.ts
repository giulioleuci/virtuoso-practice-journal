import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pickQuote, PRACTICE_QUOTES, LESSON_QUOTES } from "./quotes";
import type { Lang, Quote } from "./db";

type QuotePool = Record<string, Quote[]>;

describe("pickQuote", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a quote from the default PRACTICE_QUOTES pool in English", () => {
    const quote = pickQuote();
    expect(PRACTICE_QUOTES.en).toContainEqual(quote);
  });

  it("returns a quote for a specific language (it)", () => {
    const quote = pickQuote(PRACTICE_QUOTES, "it");
    expect(PRACTICE_QUOTES.it).toContainEqual(quote);
  });

  it("falls back to English if the requested language is missing in the pool", () => {
    const customPool: QuotePool = {
      en: [{ text: "English Quote", author: "EN Author" }],
    };
    const quote = pickQuote(customPool as unknown as Record<Lang, Quote[]>, "it" as Lang);
    expect(quote).toEqual({ text: "English Quote", author: "EN Author" });
  });

  it("returns a default quote if the pool is empty for the requested language and English", () => {
    const emptyPool: QuotePool = {
      en: [],
      it: [],
    };
    const quote = pickQuote(emptyPool as unknown as Record<Lang, Quote[]>, "it" as Lang);
    expect(quote).toEqual({ text: "Practice makes perfect.", author: "Anonymous" });
  });

  it("returns a default quote if the pool is missing both the requested language and English keys", () => {
    const emptyPool: QuotePool = {};
    const quote = pickQuote(emptyPool as unknown as Record<Lang, Quote[]>, "it" as Lang);
    expect(quote).toEqual({ text: "Practice makes perfect.", author: "Anonymous" });
  });

  it("uses Math.random to pick a quote from the list", () => {
    const customPool: QuotePool = {
      en: [
        { text: "Quote 0", author: "A0" },
        { text: "Quote 1", author: "A1" },
        { text: "Quote 2", author: "A2" },
      ],
    };

    // Pick first element
    vi.mocked(Math.random).mockReturnValue(0.1);
    expect(pickQuote(customPool as unknown as Record<Lang, Quote[]>, "en")).toEqual({ text: "Quote 0", author: "A0" });

    // Pick middle element
    vi.mocked(Math.random).mockReturnValue(0.5);
    expect(pickQuote(customPool as unknown as Record<Lang, Quote[]>, "en")).toEqual({ text: "Quote 1", author: "A1" });

    // Pick last element
    vi.mocked(Math.random).mockReturnValue(0.99);
    expect(pickQuote(customPool as unknown as Record<Lang, Quote[]>, "en")).toEqual({ text: "Quote 2", author: "A2" });
  });

  it("works with LESSON_QUOTES", () => {
    const quote = pickQuote(LESSON_QUOTES, "de");
    expect(LESSON_QUOTES.de).toContainEqual(quote);
  });
});
