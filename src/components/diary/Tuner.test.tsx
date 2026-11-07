import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Tuner } from "./Tuner";

const start = vi.fn();
vi.mock("@/hooks/useTuner", () => ({ useTuner: () => ({ status: "idle", reading: null, start, stop: vi.fn() }) }));
vi.mock("@/hooks/useReferenceTone", () => ({ useReferenceTone: () => ({ playing: false, stop: vi.fn(), toggle: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, lang: "it" }) }));

it("starts listening when opened", () => {
  render(<Tuner onClose={() => {}} />);
  expect(start).toHaveBeenCalled();
});
