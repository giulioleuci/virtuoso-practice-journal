import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: { icon: Info, cls: "border-border bg-card text-foreground", role: "status" },
  success: { icon: CheckCircle2, cls: "border-primary/30 bg-primary/5 text-foreground", role: "status" },
  error: { icon: AlertCircle, cls: "border-destructive/30 bg-destructive/5 text-destructive", role: "alert" },
} as const;

/** Inline message for a state the user should read: info, success or a recoverable error. */
export function StateNotice({ tone = "info", children, action, className }: { tone?: keyof typeof TONES; children: ReactNode; action?: ReactNode; className?: string }) {
  const { icon: Icon, cls, role } = TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-[10px] border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action}
    </div>
  );
}

/** Validation summary under a form: one line per problem, announced politely. */
export function FormErrors({ errors, className }: { errors: string[]; className?: string }) {
  if (!errors.length) return null;
  return (
    <ul role="status" className={cn("space-y-0.5 text-xs text-destructive", className)}>
      {errors.map((e) => <li key={e}>• {e}</li>)}
    </ul>
  );
}
