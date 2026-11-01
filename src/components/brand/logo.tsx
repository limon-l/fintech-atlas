import { cn } from "@/lib/utils";

export function AtlasMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
    >
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M8 23.2 15.1 8h2.1l7 15.2h-3.4l-1.4-3.3h-6.7l-1.4 3.3H8Zm5.7-6.1h4.4l-2.2-5.2-2.2 5.2Z"
        fill="var(--primary-fg)"
      />
      <circle cx="23.8" cy="9.2" r="2.1" fill="var(--teal)" />
    </svg>
  );
}

export function AtlasWordmark({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <AtlasMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-[0.18em] text-foreground">ATLAS</span>
        {subtitle ? (
          <span className="mono mt-1 text-[8.5px] uppercase tracking-[0.22em] text-subtle">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
