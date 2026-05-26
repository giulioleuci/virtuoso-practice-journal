/** Help-requests service — wraps writes for practice help questions. */
import { db } from "@/lib/db";
import { now } from "./_shared";

export const helpRequestsService = {
  async add(itemId: number, question: string): Promise<number> {
    return (await db.helpRequests.add({
      itemId,
      question,
      resolved: false,
      createdAt: now(),
    })) as number;
  },

  async answer(id: number, text: string): Promise<void> {
    await db.helpRequests.update(id, { answer: text, answeredAt: now(), resolved: true });
  },

  async remove(id: number): Promise<void> {
    await db.helpRequests.delete(id);
  },

  async saveAnswer(id: number, text: string): Promise<void> {
    const trimmed = text.trim();
    await db.helpRequests.update(id, {
      answer: trimmed || undefined,
      answeredAt: trimmed ? now() : undefined,
      resolved: !!trimmed,
    });
  },

  async resolve(id: number): Promise<void> {
    await db.helpRequests.update(id, { resolved: true });
  },

  async resolveAll(ids: number[]): Promise<void> {
    if (ids.length > 0) {
      await db.helpRequests.where("id").anyOf(ids).modify({ resolved: true });
    }
  },
};
