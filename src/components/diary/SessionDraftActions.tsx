import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function SessionDraftActions({ storageFailed, onDiscard, disabled }: { storageFailed: boolean; onDiscard: () => Promise<void>; disabled?: boolean }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  return <div className="mb-5 space-y-1">
    <p role={storageFailed ? "alert" : "status"} className={`text-xs ${storageFailed ? "text-destructive" : "text-muted-foreground"}`}>{t(storageFailed ? "draft.storageFailed" : "draft.kept")}</p>
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirm(true)}>{t("draft.discard")}</Button>
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("draft.discard")}</AlertDialogTitle><AlertDialogDescription>{t("draft.discardDescription")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => void onDiscard()}>{t("draft.discard")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
