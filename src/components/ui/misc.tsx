import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Inbox, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold tracking-[-0.035em] sm:text-[32px]">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  trend,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-card relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-surface-2 text-muted">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em]">{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {trend}
        {hint ? <p className="text-[11.5px] text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border-strong bg-surface-2/40 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[12.5px] text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md bg-surface-3", className)} />;
}

export function Avatar({
  initials,
  name,
  size = "md",
  className,
}: {
  initials: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-12 w-12 text-[14px]",
  };
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet font-bold tracking-[0.02em] text-primary-fg",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function SandboxNote({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[11px] border border-warning/20 bg-warning-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-warning",
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p>
        {children ?? (
          <>
            Sandbox environment. Balances, cards, identities and FX rates are synthetic. No real
            money moves and no live financial service is provided.
          </>
        )}
      </p>
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/25 bg-info-soft text-info",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-success/25 bg-success-soft text-success",
  };
  return (
    <div className={cn("rounded-[11px] border px-3.5 py-3 text-[12.5px] leading-relaxed", tones[tone], className)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div>
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={title ? "mt-0.5" : undefined}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function KeyValue({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", className)}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("text-right text-[12.5px] font-medium", mono && "mono text-[11.5px]")}>
        {value}
      </dd>
    </div>
  );
}

export function Disclosure({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10.5px] leading-relaxed text-subtle", className)}>{children}</p>
  );
}

export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 font-semibold text-primary hover:underline", className)}
    >
      {children}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {title || action ? (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] text-muted">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger" | "teal";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const tones = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    teal: "bg-teal",
  };
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width]", tones[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

const DOT_TONES: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
  teal: "bg-teal",
  violet: "bg-violet",
  subtle: "bg-subtle",
};

export function Dot({ tone = "success", className }: { tone?: string; className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", DOT_TONES[tone] ?? "bg-success", className)} />;
}

export function PageGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:gap-5", className)}>{children}</div>;
}

export function ActionRow({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}
