"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import {
  CONTROL_CLASSES,
  CONTROL_ERROR_CLASSES,
  FieldLabel,
  FieldMessage,
  describedBy,
  type FieldMessages,
} from "./Input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<ComponentPropsWithoutRef<"select">, "size">,
    FieldMessages {
  /** Either pass `options` or render <option> children yourself. */
  options?: SelectOption[];
  /** Disabled first option shown while the value is "". */
  placeholder?: string;
  /** Element rendered inside the field on the left (e.g. <CurrencyIcon />). */
  leftAddon?: ReactNode;
  wrapperClassName?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Styled native <select> (keeps the OS picker on mobile) with a custom chevron. */
export function Select({
  id: idProp,
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  leftAddon,
  wrapperClassName,
  className,
  children,
  ref,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? `select${autoId}`;
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
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">
            {leftAddon}
          </span>
        ) : null}
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          {...rest}
          aria-describedby={describedBy(id, messages, rest["aria-describedby"])}
          className={cn(
            CONTROL_CLASSES,
            "h-12 cursor-pointer appearance-none pl-4 pr-11",
            leftAddon && "pl-12",
            "[&>option]:bg-surface-2 [&>option]:text-fg",
            error && CONTROL_ERROR_CLASSES,
            className,
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
      </div>
      <FieldMessage id={id} messages={messages} />
    </div>
  );
}
