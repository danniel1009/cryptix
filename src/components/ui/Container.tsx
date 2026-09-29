import { createElement, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  size?: "default" | "narrow" | "wide";
  as?: "div" | "nav" | "header" | "footer" | "section";
}

const SIZES = {
  default: "max-w-[1440px]",
  narrow: "max-w-4xl",
  wide: "max-w-[1600px]",
} as const;

/** Horizontal page gutter. Sections stay full-width; this sits inside them. */
export function Container({ size = "default", as = "div", className, children, ...rest }: ContainerProps) {
  return createElement(
    as,
    {
      className: cn("mx-auto w-full px-5 sm:px-8 lg:px-12 2xl:px-16", SIZES[size], className),
      ...rest,
    },
    children,
  );
}
