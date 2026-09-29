import { createElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps extends ComponentPropsWithoutRef<"p"> {
  as?: "p" | "span" | "div";
  /** Small accent dash before the text. */
  dash?: boolean;
}

/** Mono, accent, uppercase label above a heading ("01 — LIVE MARKET"). */
export function Eyebrow({ as = "p", dash = true, className, children, ...rest }: EyebrowProps) {
  return createElement(
    as,
    {
      className: cn(
        "inline-flex items-center gap-2.5 font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent",
        className,
      ),
      ...rest,
    },
    dash ? <span aria-hidden="true" className="h-px w-5 bg-accent/70" /> : null,
    children,
  );
}

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
  /** id for the heading element (aria-labelledby on the section). */
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  as = "h2",
  align = "left",
  className,
  titleClassName,
  id,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col", centered ? "items-center text-center" : "items-start", className)}>
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      {createElement(
        as,
        {
          id,
          className: cn(
            "text-3xl font-semibold tracking-tight text-fg sm:text-4xl lg:text-5xl",
            titleClassName,
          ),
        },
        title,
      )}
      {description ? (
        <p className={cn("mt-4 max-w-2xl text-base text-muted sm:mt-5 sm:text-lg", centered && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
