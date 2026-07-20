import { db } from "@/infrastructure/dexie/db";
import type { HelpRequestPort } from "@/domain/ports/helpRequest";
import { now } from "@/lib/date";

export const helpRequestRepository = {
  add: (itemId: number, question: string) => db.helpRequests.add({ itemId, question, resolved: false, createdAt: now() }) as Promise<number>,
  answer: async (id: number, text: string) => { await db.helpRequests.update(id, { answer: text, answeredAt: now(), resolved: true }); },
  remove: async (id: number) => { await db.helpRequests.delete(id); },
  async saveAnswer(id: number, text: string) { const answer = text.trim(); await db.helpRequests.update(id, { answer: answer || undefined, answeredAt: answer ? now() : undefined, resolved: !!answer }); },
  resolve: async (id: number) => { await db.helpRequests.update(id, { resolved: true }); },
  async resolveAll(ids: number[]) { if (ids.length) await db.helpRequests.where("id").anyOf(ids).modify({ resolved: true }); },
} satisfies HelpRequestPort;
