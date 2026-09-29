"use client";

import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { Select, type SelectProps } from "@/components/ui/Select";
import { SUPPORTED_PAIRS, getPairById, pairLabel, type PairId } from "@/config/exchange";
import { cn } from "@/lib/utils";

export interface PairSelectProps
  extends Omit<SelectProps, "options" | "leftAddon" | "children" | "value" | "onChange" | "placeholder"> {
  value: PairId;
  onValueChange: (pairId: string) => void;
}

/** The ONLY selectable pairs — labels are language independent ("USDT → BTC"). */
const OPTIONS = SUPPORTED_PAIRS.map((pair) => ({ value: pair.id, label: pairLabel(pair) }));

/**
 * Native <select> of the supported pairs with the two coin marks of the
 * current pair overlapping on the left, so the choice reads at a glance.
 */
export function PairSelect({ value, onValueChange, className, ...rest }: PairSelectProps) {
  const pair = getPairById(value) ?? SUPPORTED_PAIRS[0];
  return (
    <Select
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      options={OPTIONS}
      leftAddon={
        <span className="flex items-center -space-x-2">
          <CurrencyIcon code={pair.from} size={22} decorative />
          <CurrencyIcon code={pair.to} size={22} decorative className="rounded-full ring-2 ring-surface-2" />
        </span>
      }
      className={cn("pl-[4.25rem] font-medium", className)}
      {...rest}
    />
  );
}
