import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-ink-100 bg-white px-4 py-2 text-sm text-ink-900",
        "placeholder:text-ink-400 focus:border-skywash-500 focus:outline-none focus:ring-2 focus:ring-skywash-200",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
