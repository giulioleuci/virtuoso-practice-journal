export const THEORY_LAYERS = ["conceptual", "analytical", "aural", "compositional", "reading"] as const;

export type TheoryLayer = typeof THEORY_LAYERS[number];
