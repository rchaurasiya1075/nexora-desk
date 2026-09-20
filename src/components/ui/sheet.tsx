import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "bottom",
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "bottom" | "right";
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-bg-elevated text-fg shadow-[var(--shadow-border)] outline-none",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[86dvh] rounded-t-xl pb-[env(safe-area-inset-bottom)]",
          side === "right" && "inset-y-0 right-0 h-full w-[min(100%,380px)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <DialogPrimitive.Title className="font-display text-lg">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="flex size-11 items-center justify-center rounded-sm text-muted hover:text-fg">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
