import * as React from "react";
import { cn } from "@/lib/utils";

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("h-2 w-full rounded-full bg-ink-100", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-skywash-500 transition"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
);

Progress.displayName = "Progress";

export { Progress };
