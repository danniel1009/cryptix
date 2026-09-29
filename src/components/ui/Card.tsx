import { createElement, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type CardTag = "div" | "article" | "section" | "li" | "aside";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  as?: CardTag;
  /** Emerald glow for the most important cards (rate checker, primary CTA). */
  glow?: boolean;
  /** Hover: border brightens and the card lifts slightly. */
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-6 sm:p-7",
  lg: "p-7 sm:p-10",
} as const;

export function Card({
  as = "div",
  glow = false,
  interactive = false,
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return createElement(
    as,
    {
      className: cn(
        "relative rounded-2xl border border-line bg-surface/80 shadow-card",
        "transition-[border-color,transform,box-shadow,background-color] duration-300 ease-out-expo",
        interactive && "hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface",
        glow && "border-accent/25 glow-accent",
        PADDING[padding],
        className,
      ),
      ...rest,
    },
    children,
  );
}

export function CardHeader({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)} {...rest}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends ComponentPropsWithoutRef<"h3"> {
  as?: "h2" | "h3" | "h4" | "p";
}

export function CardTitle({ as = "h3", className, children, ...rest }: CardTitleProps) {
  return createElement(
    as,
    { className: cn("text-lg font-semibold tracking-tight text-fg", className), ...rest },
    children,
  );
}

export function CardDescription({ className, children, ...rest }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={cn("mt-1 text-sm leading-relaxed text-muted", className)} {...rest}>
      {children}
    </p>
  );
}

export function CardFooter({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("mt-6 flex items-center gap-3 border-t border-line pt-5", className)} {...rest}>
      {children}
    </div>
  );
}

