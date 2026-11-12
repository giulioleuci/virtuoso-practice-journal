/** Metronome support ladder, most support to least. */
export const CLICK_LEVELS = ["all", "1-3", "first", "bar2", "bar4", "none"] as const;

export type ClickLevel = typeof CLICK_LEVELS[number];
