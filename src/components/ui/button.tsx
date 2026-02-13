import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-skywash-600 text-white hover:bg-skywash-700",
  secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200",
  ghost: "bg-transparent text-ink-800 hover:bg-ink-100",
  outline: "border border-ink-200 text-ink-900 hover:bg-ink-100",
  danger: "bg-signal-500 text-white hover:bg-signal-600"
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base"
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skywash-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";

export { Button };
