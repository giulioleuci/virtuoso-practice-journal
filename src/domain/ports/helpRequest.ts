export interface HelpRequest {
  id: number;
  sessionId?: number;
  taskId?: number;
  itemId?: number;
  question: string;
  answer?: string;
  answeredAt?: number;
  resolved: boolean;
  createdAt: number;
}

export interface HelpRequestPort {
  add(itemId: number, question: string): Promise<number>;
  answer(id: number, text: string): Promise<void>;
  remove(id: number): Promise<void>;
  saveAnswer(id: number, text: string): Promise<void>;
  resolve(id: number): Promise<void>;
  resolveAll(ids: number[]): Promise<void>;
}
