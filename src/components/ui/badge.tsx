import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "signal" | "sky";
};

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-ink-100 text-ink-800",
  signal: "bg-signal-100 text-signal-800",
  sky: "bg-skywash-100 text-skywash-800"
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, tone = "neutral", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  )
);

Badge.displayName = "Badge";

export { Badge };
