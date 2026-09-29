"use client";

import { RefreshCw, TriangleAlert, WifiOff, RadioTower } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketConnection } from "@/providers/MarketProvider";
import { cn } from "@/lib/utils";
import type { MarketView } from "./rows";

export interface MarketStatusBannerProps {
  view: MarketView;
  connection: MarketConnection;
  /** `snapshot.sources` includes "mock" (development provider). */
  isMock: boolean;
  onRetry: () => void;
  className?: string;
}

type Tone = "warning" | "neutral";

function Note({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: Tone;
  icon: ReactNode;
  title?: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:px-5",
        tone === "warning" ? "border-warning/25 bg-warning/[0.06]" : "border-line bg-surface-2/70",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border [&>svg]:h-3.5 [&>svg]:w-3.5",
            tone === "warning" ? "border-warning/40 text-warning" : "border-line-strong text-muted",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          {title ? <p className="text-sm font-medium text-fg">{title}</p> : null}
          <p className={cn("text-sm leading-relaxed text-muted", title && "mt-0.5")}>{body}</p>
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pl-2">{action}</div> : null}
    </div>
  );
}

/**
 * Notices above the market rows, stacked in priority order:
 * dev-mock badge → unavailable (with retry) → stale → polling → offline.
 * Nothing renders while the first snapshot is still loading. The stack is one
 * polite live region so a state change is announced once.
 */
export function MarketStatusBanner({ view, connection, isMock, onRetry, className }: MarketStatusBannerProps) {
  const { t } = useI18n();
  if (view === "loading") return null;

  const notes: ReactNode[] = [];

  if (isMock) {
    notes.push(
      <div key="mock">
        <Badge variant="warning" dot>
          {t.market.devMock}
        </Badge>
      </div>,
    );
  }

  if (view === "unavailable") {
    notes.push(
      <Note
        key="unavailable"
        tone="warning"
        icon={<TriangleAlert />}
        title={t.market.unavailableTitle}
        body={t.market.unavailableBody}
        action={
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={onRetry}>
            {t.common.retry}
          </Button>
        }
      />,
    );
  } else if (view === "stale") {
    notes.push(<Note key="stale" tone="warning" icon={<TriangleAlert />} body={t.market.staleBody} />);
  }

  if (connection === "polling") {
    notes.push(<Note key="polling" tone="neutral" icon={<RadioTower />} body={t.market.pollingNote} />);
  }
  if (connection === "offline") {
    notes.push(<Note key="offline" tone="warning" icon={<WifiOff />} body={t.market.offlineNote} />);
  }

  if (notes.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col gap-3", className)}>
      {notes}
    </div>
  );
}
