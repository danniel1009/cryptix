"use client";

import { Check } from "lucide-react";
import { useId, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { FieldMessage, describedBy, type FieldMessages } from "./Input";

export interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<"input">, "type" | "size">,
    Omit<FieldMessages, "label"> {
  /** Visible label (may contain links, e.g. consent text). */
  label: ReactNode;
  description?: ReactNode;
  wrapperClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Native checkbox styled with `appearance-none` (no sr-only tricks, so it never
 * affects document scrolling) and a checkmark overlay driven by `peer-checked`.
 */
export function Checkbox({
  id: idProp,
  label,
  description,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  ref,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? `checkbox${autoId}`;
  const messages = { hint, error, required };

  return (
    <div className={cn("w-full", wrapperClassName)}>
      <label htmlFor={id} className="relative flex cursor-pointer items-start gap-3">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, messages, rest["aria-describedby"])}
          className={cn(
            "peer mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface-2",
            "transition-[background-color,border-color,box-shadow] duration-200",
            "hover:border-white/25 checked:border-accent checked:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger/60",
            className,
          )}
          {...rest}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute left-[3px] top-[5px] h-3.5 w-3.5 text-bg opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
        />
        <span className="text-sm leading-relaxed text-muted transition-colors peer-checked:text-fg">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-accent">
              *
            </span>
          ) : null}
          {description ? <span className="mt-1 block text-xs text-faint">{description}</span> : null}
        </span>
      </label>
      <FieldMessage id={id} messages={messages} />
    </div>
  );
}
