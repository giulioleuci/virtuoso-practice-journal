import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Adaptive container: a bottom Drawer (Vaul) on mobile, a Dialog on desktop.
 * Mobile forms get keyboard-aware padding and dynamic viewport heights, and
 * autofocus is suppressed so the keyboard doesn't jump up on open.
 */
interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveSheet({ open, onOpenChange, title, description, footer, className, children }: ResponsiveSheetProps) {
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn("max-h-[92dvh] p-0 flex flex-col", className)}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DrawerHeader className="text-left px-5 pt-4 pb-2">
            <DrawerTitle className="font-serif text-2xl">{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto px-5 pb-4 space-y-4"
            style={{ paddingBottom: keyboardInset ? keyboardInset + 16 : undefined }}
          >
            {children}
          </div>
          {footer && (
            <DrawerFooter className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85dvh] flex flex-col", className)}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
