/** Help-requests service — wraps writes for practice help questions. */
import { helpRequestRepository } from "@/infrastructure/repositories/dexie/helpRequestRepository";
export const helpRequestsService = helpRequestRepository;
