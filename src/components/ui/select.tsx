import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full appearance-none rounded-2xl border border-ink-100 bg-white px-4 py-2 text-sm text-ink-900",
        "focus:border-skywash-500 focus:outline-none focus:ring-2 focus:ring-skywash-200",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);

Select.displayName = "Select";

export { Select };
