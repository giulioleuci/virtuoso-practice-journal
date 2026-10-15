import Dexie, { type Table } from "dexie";

/** Audio bytes, kept in their own database so backup export, import and data wipes of the app tables never see them. */
interface ClipRow { uid: string; data: ArrayBuffer; mimeType: string }

class AudioDB extends Dexie {
  declare clips: Table<ClipRow, string>;
  constructor() {
    super("virtuoso-audio");
    this.version(1).stores({ clips: "uid" });
  }
}

export const audioDb = new AudioDB();
