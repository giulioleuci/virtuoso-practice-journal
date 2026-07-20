import type { LucideIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";

export function FeatureEmptyState({
  icon,
  title,
  description,
  action,
  quote,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  quote?: { text: string; author: string };
}) {
  return <EmptyState icon={icon} title={title} hint={description} cta={action} quote={quote} />;
}
