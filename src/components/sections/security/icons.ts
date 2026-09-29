import { Activity, Gauge, KeyRound, Lock, Server, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Icon per `t.security.items[i]`, in dictionary order:
 * secure communication · protected infrastructure · server-side credentials ·
 * input validation · rate-limit protection · market data verification.
 */
export const SECURITY_ITEM_ICONS: readonly LucideIcon[] = [Lock, Server, KeyRound, ShieldCheck, Gauge, Activity];
