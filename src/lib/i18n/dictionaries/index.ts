import { en } from "./en";
import { id } from "./id";
import type { Locale } from "@/lib/i18n/types";

/** Shape of every dictionary; derived from English so `id` cannot drift. */
export type Dictionary = typeof en;

export const dictionaries: Record<Locale, Dictionary> = { en, id };

/** Replace `{key}` placeholders in a dictionary string. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}
