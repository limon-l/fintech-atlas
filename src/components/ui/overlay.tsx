"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: DialogPrimitive.DialogContentProps & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="atlas-overlay fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "atlas-dialog fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-elevated p-5 shadow-float focus:outline-none sm:p-6",
          className,
        )}
        {...props}
      >
        <div className="pr-8">
          <DialogPrimitive.Title className="text-[18px] font-semibold tracking-tight">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
        <div className="mt-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetContent({
  className,
  children,
  title,
  description,
  side = "right",
  ...props
}: DialogPrimitive.DialogContentProps & {
  title: string;
  description?: string;
  side?: "right" | "left" | "bottom";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="atlas-overlay fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "atlas-sheet fixed z-50 flex flex-col border-border bg-elevated shadow-float focus:outline-none",
          side === "right" && "inset-y-0 right-0 w-full max-w-md border-l",
          side === "left" && "inset-y-0 left-0 w-full max-w-md border-r",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[20px] border-t",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-[16px] font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[12px] text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
