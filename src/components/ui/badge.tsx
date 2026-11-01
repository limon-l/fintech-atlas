import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-[0.01em]",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-2 text-muted",
        outline: "border-border-strong bg-transparent text-foreground",
        success: "border-success/25 bg-success-soft text-success",
        warning: "border-warning/25 bg-warning-soft text-warning",
        danger: "border-danger/25 bg-danger-soft text-danger",
        info: "border-info/25 bg-info-soft text-info",
        primary: "border-primary/25 bg-primary-soft text-primary",
        teal: "border-teal/25 bg-teal-soft text-teal",
        violet: "border-violet/25 bg-violet-soft text-violet",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"]; dot: string }> = {
  posted: { label: "Posted", variant: "success", dot: "bg-success" },
  settled: { label: "Settled", variant: "success", dot: "bg-success" },
  paid: { label: "Paid", variant: "success", dot: "bg-success" },
  approved: { label: "Approved", variant: "success", dot: "bg-success" },
  verified: { label: "Verified", variant: "success", dot: "bg-success" },
  matched: { label: "Matched", variant: "success", dot: "bg-success" },
  active: { label: "Active", variant: "success", dot: "bg-success" },
  complete: { label: "Complete", variant: "success", dot: "bg-success" },
  delivered: { label: "Delivered", variant: "success", dot: "bg-success" },
  reimbursed: { label: "Reimbursed", variant: "teal", dot: "bg-teal" },
  processing: { label: "Processing", variant: "info", dot: "bg-info" },
  authorized: { label: "Authorized", variant: "info", dot: "bg-info" },
  pending: { label: "Pending", variant: "warning", dot: "bg-warning" },
  pending_authorization: { label: "Awaiting authorization", variant: "warning", dot: "bg-warning" },
  awaiting_approval: { label: "Awaiting approval", variant: "warning", dot: "bg-warning" },
  reviewing: { label: "Reviewing", variant: "warning", dot: "bg-warning" },
  info_requested: { label: "Info requested", variant: "warning", dot: "bg-warning" },
  partially_paid: { label: "Partially paid", variant: "warning", dot: "bg-warning" },
  scheduled: { label: "Scheduled", variant: "violet", dot: "bg-violet" },
  sent: { label: "Sent", variant: "info", dot: "bg-info" },
  open: { label: "Open", variant: "warning", dot: "bg-warning" },
  draft: { label: "Draft", variant: "neutral", dot: "bg-subtle" },
  void: { label: "Void", variant: "neutral", dot: "bg-subtle" },
  canceled: { label: "Canceled", variant: "neutral", dot: "bg-subtle" },
  archived: { label: "Archived", variant: "neutral", dot: "bg-subtle" },
  reversed: { label: "Reversed", variant: "violet", dot: "bg-violet" },
  failed: { label: "Failed", variant: "danger", dot: "bg-danger" },
  rejected: { label: "Rejected", variant: "danger", dot: "bg-danger" },
  overdue: { label: "Overdue", variant: "danger", dot: "bg-danger" },
  frozen: { label: "Frozen", variant: "danger", dot: "bg-danger" },
  exception: { label: "Exception", variant: "danger", dot: "bg-danger" },
  escalated: { label: "Escalated", variant: "danger", dot: "bg-danger" },
  cleared: { label: "Cleared", variant: "neutral", dot: "bg-subtle" },
  suspended: { label: "Suspended", variant: "danger", dot: "bg-danger" },
  unverified: { label: "Unverified", variant: "warning", dot: "bg-warning" },
  resolved: { label: "Resolved", variant: "success", dot: "bg-success" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_MAP[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    variant: "neutral" as const,
    dot: "bg-subtle",
  };
  return (
    <Badge variant={meta.variant} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
