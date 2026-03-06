import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Props for the AuthForm component.
 */
interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The source URL or base64 string for the company logo.
   */
  logoSrc: string;
  /**
   * Alt text for the company logo for accessibility.
   */
  logoAlt?: string;
  /**
   * The main title of the form.
   */
  title?: string;
  /**
   * A short description or subtitle displayed below the title.
   */
  description?: string;
  /**
   * The primary call-to-action button (e.g., social login).
   */
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
  /**
   * An array of secondary action buttons.
   */
  secondaryActions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }[];
  /**
   * An optional action for skipping the login process.
   */
  skipAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Custom content rendered inside the card body (before actions).
   */
  children?: React.ReactNode;
  /**
   * Custom content to be displayed in the footer area.
   */
  footerContent?: React.ReactNode;
  logoClassName?: string;
}

/**
 * A reusable authentication form component built with shadcn/ui.
 * It supports various providers, a customizable header, and animations.
 */
const AuthForm = React.forwardRef<HTMLDivElement, AuthFormProps>(
  (
    {
      className,
      logoSrc,
      logoAlt = "Company Logo",
      title,
      description,
      primaryAction,
      secondaryActions,
      skipAction,
      children,
      footerContent,
      logoClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn("flex flex-col items-center justify-center", className)}
      >
        <Card
          ref={ref}
          className={cn(
            "w-full max-w-sm",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500",
          )}
          {...props}
        >
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <img
                src={logoSrc}
                alt={logoAlt}
                className={cn(
                  "h-12 w-12 rounded-[4px] object-contain",
                  logoClassName,
                )}
              />
            </div>
            {title && (
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {title}
              </CardTitle>
            )}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4">
            {children}

            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="w-full transition-transform hover:scale-[1.03]"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            )}

            {secondaryActions && secondaryActions.length > 0 && (
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              {secondaryActions?.map((action, index) => (
                <Button
                  key={index}
                  variant="secondary"
                  className="w-full transition-transform hover:scale-[1.03]"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>

          {skipAction && (
            <CardFooter className="flex flex-col">
              <Button
                variant="outline"
                className="w-full transition-transform hover:scale-[1.03]"
                onClick={skipAction.onClick}
              >
                {skipAction.label}
              </Button>
            </CardFooter>
          )}
        </Card>

        {footerContent && (
          <div className="mt-6 w-full max-w-sm px-8 text-center text-sm text-muted-foreground animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500 [animation-delay:200ms]">
            {footerContent}
          </div>
        )}
      </div>
    );
  },
);
AuthForm.displayName = "AuthForm";

export { AuthForm };
export type { AuthFormProps };
