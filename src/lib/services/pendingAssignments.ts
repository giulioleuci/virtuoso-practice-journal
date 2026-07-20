/** Pending (draft) homework — captured async during a lesson, before it's logged. */
import { pendingAssignmentRepository } from "@/infrastructure/repositories/dexie/pendingAssignmentRepository";
export const pendingAssignmentsService = pendingAssignmentRepository;
