import type { Session } from "@/domain/entities/session";
import type { SessionPort } from "@/domain/ports/session";
export type SessionDto = Session;
export interface SessionQueries { list(): Promise<SessionDto[]>; }
export const sessionQueries = (sessions: SessionPort): SessionQueries => ({ list: () => sessions.list() });
