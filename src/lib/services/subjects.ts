/** Subjects service — wraps writes for subjects and techniques. */
import { subjectRepository } from "@/infrastructure/repositories/dexie/subjectRepository";
export const subjectsService = subjectRepository;
