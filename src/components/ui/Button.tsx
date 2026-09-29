"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "whatsapp";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Shows a spinner, sets aria-busy and disables interaction. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

type OmittedKeys = keyof ButtonBaseProps | "ref";

export type ButtonAsButtonProps = ButtonBaseProps &
  Omit<HTMLMotionProps<"button">, OmittedKeys | "href"> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

export type ButtonAsAnchorProps = ButtonBaseProps &
  Omit<HTMLMotionProps<"a">, OmittedKeys> & {
    /** When given the button renders as an <a>. */
    href: string;
    /** Anchors have no native disabled state; emulated via aria-disabled. */
    disabled?: boolean;
    ref?: Ref<HTMLAnchorElement>;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-200 ease-out-expo " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-bg shadow-[0_0_0_1px_rgba(34,229,138,0.35),0_10px_30px_-12px_rgba(34,229,138,0.55)] " +
    "hover:bg-[#3AF29B] hover:shadow-[0_0_0_1px_rgba(34,229,138,0.5),0_12px_36px_-12px_rgba(34,229,138,0.7)]",
  secondary:
    "border border-line-strong bg-white/[0.03] text-fg hover:border-white/25 hover:bg-white/[0.06]",
  ghost: "text-muted hover:bg-white/[0.05] hover:text-fg",
  outline: "border border-accent/40 text-accent hover:border-accent/70 hover:bg-accent-soft",
  whatsapp:
    "bg-whatsapp text-[#04140B] shadow-[0_0_0_1px_rgba(37,211,102,0.35),0_10px_30px_-12px_rgba(37,211,102,0.6)] " +
    "hover:bg-[#3AE27A]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm uppercase tracking-[0.12em]",
  xl: "h-14 px-8 text-[15px] uppercase tracking-[0.14em]",
};

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18, xl: 20 };

/**
 * Polymorphic button: renders <a> when `href` is given, otherwise <button>.
 * Subtle hover lift / tap press via Framer Motion (disabled under reduced motion).
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading = false,
    fullWidth = false,
    className,
    children,
    ...rest
  } = props;
  const reduced = useReducedMotionSafe();
  const disabled = Boolean(rest.disabled) || loading;

  const classes = cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);

  const motionProps = reduced || disabled
    ? {}
    : {
        whileHover: { y: -1 },
        whileTap: { scale: 0.98, y: 0 },
        transition: { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.6 },
      };

  const content = (
    <>
      {loading ? (
        <Spinner size={SPINNER_SIZE[size]} className="shrink-0" />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      <span className="inline-flex items-center">{children}</span>
      {rightIcon ? (
        <span className="inline-flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, disabled: _disabled, ref, ...anchorRest } = rest as ButtonAsAnchorProps;
    void _disabled;
    return (
      <motion.a
        ref={ref}
        href={disabled ? undefined : href}
        role={disabled ? "link" : undefined}
        aria-disabled={disabled || undefined}
        aria-busy={loading || undefined}
        tabIndex={disabled ? -1 : undefined}
        className={classes}
        {...motionProps}
        {...(anchorRest as HTMLMotionProps<"a">)}
      >
        {content}
      </motion.a>
    );
  }

  const { disabled: _disabled, ref, type = "button", ...buttonRest } = rest as ButtonAsButtonProps;
  void _disabled;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={classes}
      {...motionProps}
      {...(buttonRest as HTMLMotionProps<"button">)}
    >
      {content}
    </motion.button>
  );
}
