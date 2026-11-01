"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled} aria-busy={pending} className={cn(className)}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel ?? "Working…" : children}
    </Button>
  );
}
