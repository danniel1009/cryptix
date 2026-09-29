"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared field scaffolding (label / hint / error), reused by Textarea, */
/* Select and Checkbox so every control announces errors the same way.  */
/* ------------------------------------------------------------------ */

export interface FieldMessages {
  label?: ReactNode;
  hint?: ReactNode;
  /** Already-localised error text (map codes via t.validation[code] first). */
  error?: ReactNode;
  required?: boolean;
}

export function fieldIds(id: string) {
  return { hintId: `${id}-hint`, errorId: `${id}-error` };
}

/** Build aria-describedby from the messages that are actually rendered. */
export function describedBy(id: string, messages: FieldMessages, extra?: string): string | undefined {
  const { hintId, errorId } = fieldIds(id);
  const ids = [extra, messages.error ? errorId : null, messages.hint ? hintId : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldLabel({
  htmlFor,
  required,
  className,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-medium text-fg", className)}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-1 text-accent">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldMessage({ id, messages }: { id: string; messages: FieldMessages }) {
  const { hintId, errorId } = fieldIds(id);
  if (messages.error) {
    return (
      <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-danger">
        {messages.error}
      </p>
    );
  }
  if (messages.hint) {
    return (
      <p id={hintId} className="mt-2 text-xs text-faint">
        {messages.hint}
      </p>
    );
  }
  return null;
}

/** Base classes for text-like controls (Input, Textarea, Select). */
export const CONTROL_CLASSES =
  "block w-full rounded-xl border border-line bg-surface-2 text-base text-fg placeholder:text-faint " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-line-strong focus:border-accent/60 focus:outline-none focus:ring-[3px] focus:ring-accent/15 " +
  "disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-80";

export const CONTROL_ERROR_CLASSES =
  "border-danger/60 hover:border-danger/70 focus:border-danger/70 focus:ring-danger/15";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface InputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "size">,
    FieldMessages {
  /** Element rendered inside the field on the left (icon, "Rp"). */
  leftAddon?: ReactNode;
  /** Element rendered inside the field on the right (currency code, button). */
  rightAddon?: ReactNode;
  /** Use mono tabular digits (amounts). */
  mono?: boolean;
  wrapperClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  id: idProp,
  label,
  hint,
  error,
  required,
  leftAddon,
  rightAddon,
  mono = false,
  wrapperClassName,
  className,
  ref,
  ...rest
}: InputProps) {
  const autoId = useId();
  const id = idProp ?? `input${autoId}`;
  const messages = { label, hint, error, required };

  return (
    <div className={cn("w-full", wrapperClassName)}>
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <div className="relative">
        {leftAddon ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted [&>svg]:h-4 [&>svg]:w-4">
            {leftAddon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          {...rest}
          aria-describedby={describedBy(id, messages, rest["aria-describedby"])}
          className={cn(
            CONTROL_CLASSES,
            "h-12 px-4",
            leftAddon && "pl-11",
            rightAddon && "pr-14",
            mono && "font-mono nums",
            error && CONTROL_ERROR_CLASSES,
            className,
          )}
        />
        {rightAddon ? (
          <span className="absolute inset-y-0 right-4 flex items-center font-mono text-sm text-muted">
            {rightAddon}
          </span>
        ) : null}
      </div>
      <FieldMessage id={id} messages={messages} />
    </div>
  );
}
