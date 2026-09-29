import { cn } from "@/lib/utils";

export interface GlowLineProps {
  className?: string;
}

/**
 * The lit "screen edge" that closes the hero: a 1px emerald line fading at
 * both ends, two blurred glow layers on top of it, and a faint radial light
 * spill falling onto the area below (kept INSIDE this element's box so the
 * next section can never paint over it). Purely decorative.
 */
export function GlowLine({ className }: GlowLineProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative h-14 w-full select-none sm:h-20", className)}
    >
      {/* Wide, very soft glow */}
      <div className="absolute inset-x-[4%] top-[-1px] h-[3px] bg-[linear-gradient(90deg,transparent_0%,rgba(34,229,138,0.3)_35%,rgba(34,229,138,0.3)_65%,transparent_100%)] blur-2xl" />
      {/* Tighter glow */}
      <div className="absolute inset-x-[14%] top-[-1px] h-[2px] bg-[linear-gradient(90deg,transparent_0%,rgba(34,229,138,0.6)_40%,rgba(34,229,138,0.6)_60%,transparent_100%)] blur-md" />
      {/* The 1px line itself */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(34,229,138,0.35)_22%,#22E58A_50%,rgba(34,229,138,0.35)_78%,transparent_100%)]" />
      {/* Light spill below the edge */}
      <div className="absolute left-1/2 top-0 h-full w-[76%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(34,229,138,0.14)_0%,rgba(34,229,138,0.04)_45%,transparent_75%)]" />
    </div>
  );
}
