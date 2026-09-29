"use client";

import { cn } from "@/lib/utils";

export interface AmountInputProps {
  id: string;
  /** Raw text while typing, formatted amount otherwise (owned by useRateChecker). */
  value: string;
  onChange: (text: string) => void;
  /** Blur → the hook replaces a valid draft with its formatted form. */
  onBlur: () => void;
  placeholder: string;
  /** Space-separated ids naming the field ("You send" + "Amount"). */
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * The big mono amount field of the converter's "From" panel — the largest text
 * in the card (`text-3xl sm:text-5xl`, ≥ 16px everywhere so iOS never zooms).
 * A text input (not number) so both "1,000.50" and "1.000,50" can be typed;
 * `inputMode="decimal"` still brings up the numeric keypad on phones. Focus
 * styling is carried by the panel (`focus-within`), so the input has no
 * visible border or outline of its own.
 */
export function AmountInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  labelledBy,
  describedBy,
  invalid = false,
  className,
}: AmountInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="done"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(
        "nums block w-full min-w-0 border-0 bg-transparent p-0 font-mono text-3xl font-medium leading-tight tracking-tight text-fg",
        "placeholder:text-faint placeholder:font-normal focus:outline-none focus-visible:outline-none sm:text-5xl",
        // The panel carries the focus ring (focus-within); under forced colours box-shadows vanish, so restore an outline there.
        "forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-4 forced-colors:focus-visible:outline-[Highlight]",
        invalid && "text-danger",
        className,
      )}
    />
  );
}
