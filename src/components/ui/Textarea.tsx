"use client";

import { useId, type ComponentPropsWithoutRef, type Ref } from "react";
import { cn } from "@/lib/utils";
import {
  CONTROL_CLASSES,
  CONTROL_ERROR_CLASSES,
  FieldLabel,
  FieldMessage,
  describedBy,
  type FieldMessages,
} from "./Input";

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea">, FieldMessages {
  wrapperClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  id: idProp,
  label,
  hint,
  error,
  required,
  rows = 4,
  wrapperClassName,
  className,
  ref,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const id = idProp ?? `textarea${autoId}`;
  const messages = { label, hint, error, required };

  return (
    <div className={cn("w-full", wrapperClassName)}>
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, messages, rest["aria-describedby"])}
        className={cn(
          CONTROL_CLASSES,
          "min-h-[120px] resize-y px-4 py-3 leading-relaxed scrollbar-thin",
          error && CONTROL_ERROR_CLASSES,
          className,
        )}
        {...rest}
      />
      <FieldMessage id={id} messages={messages} />
    </div>
  );
}
