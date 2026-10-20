import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function SessionDraftActions({ storageFailed, hasContent, onDiscard, disabled }: { storageFailed: boolean; hasContent: boolean; onDiscard: () => Promise<void>; disabled?: boolean }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  // A pristine form has nothing to keep or discard; a storage failure is always reported.
  if (!hasContent && !storageFailed) return null;
  return <div className="mb-5 space-y-1">
    <p role={storageFailed ? "alert" : "status"} className={`text-xs ${storageFailed ? "text-destructive" : "text-muted-foreground"}`}>{t(storageFailed ? "draft.storageFailed" : "draft.kept")}</p>
    {hasContent && <Button type="button" variant="ghost" size="sm" className="max-sm:min-h-11" disabled={disabled} onClick={() => setConfirm(true)}>{t("draft.discard")}</Button>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("draft.discard")}</AlertDialogTitle><AlertDialogDescription>{t("draft.discardDescription")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => void onDiscard()}>{t("draft.discard")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
