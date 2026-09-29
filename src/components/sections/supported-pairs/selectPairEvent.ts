import type { PairId } from "@/config/exchange";

/**
 * Cross-section contract (docs/ARCHITECTURE.md): a card dispatches this event
 * on `window`, then smooth-scrolls to `#exchange`; the RateChecker listens and
 * selects the pair. The literal is the contract — do not rename.
 */
export const SELECT_PAIR_EVENT = "cryptix:select-pair";

export interface SelectPairDetail {
  pairId: PairId;
}

export function dispatchSelectPair(pairId: PairId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail: { pairId } }));
}
