import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/config/site";
import { dictionaries, interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { LOCALES } from "@/lib/i18n/types";

/**
 * Structural parity between the English (source of truth) and Indonesian
 * dictionaries, plus content rules every string must obey:
 *  - identical key trees (objects AND array lengths / element shapes)
 *  - every leaf is a non-empty, trimmed string
 *  - identical `{placeholder}` sets per leaf path
 *  - no forbidden marketing / regulatory phrases in either language
 *  - sentence-case copy: only tiny mono labels may be all-caps
 *  - contract keys other agents depend on exist (nav ids, error codes)
 */

interface Leaf {
  path: string;
  value: string;
}

/** Flatten a dictionary into `[{ path: "hero.supporting[0]", value }]`. */
function collectLeaves(node: unknown, path: string, out: Leaf[]): void {
  if (typeof node === "string") {
    out.push({ path, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectLeaves(item, `${path}[${i}]`, out));
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      collectLeaves(value, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  throw new Error(`Unsupported dictionary leaf at "${path}": ${typeof node}`);
}

function leavesByPath(dict: unknown): Map<string, string> {
  const leaves: Leaf[] = [];
  collectLeaves(dict, "", leaves);
  return new Map(leaves.map((l) => [l.path, l.value]));
}

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
}

/**
 * Phrases the product must never use (see docs/ARCHITECTURE.md). Matched
 * case-insensitively as substrings, so "otomatis" also catches
 * "secara otomatis" and "dijamin" catches "tidak dijamin".
 */
const FORBIDDEN_PHRASES: readonly string[] = [
  // English
  "trade now",
  "buy now",
  "sell now",
  "execute trade",
  "transaction successful",
  "100% secure",
  "bank-grade",
  "guaranteed",
  "licensed",
  "instantly",
  "automatic exchange",
  // Indonesian equivalents
  "otomatis",
  "dijamin",
  "berlisensi",
  "transaksi berhasil",
  "transaksi sukses",
  "beli sekarang",
  "jual sekarang",
  "100% aman",
  "setara bank",
];

/**
 * docs/DESIGN.md copy-case rule: headings, titles, buttons and links are
 * sentence case. Only tiny mono labels stay uppercase. Anything all-caps with
 * four or more letters must match one of these paths.
 */
const ALL_CAPS_ALLOWED: readonly RegExp[] = [
  /^(common|rateChecker)\.spreadBadge$/,
  /^(common|rateChecker|pairs)\.ourRateFormula$/,
  /^market\.(live|reconnecting|unavailable|stale)$/,
];

function isAllCaps(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

const enLeaves = leavesByPath(en);
const idLeaves = leavesByPath(id);

describe("dictionary registry", () => {
  it("exposes every locale and the English/Indonesian objects", () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...LOCALES].sort());
    expect(dictionaries.en).toBe(en);
    expect(dictionaries.id).toBe(id);
  });

  it("lists the same namespaces in both index files", () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("en ↔ id structural parity", () => {
  it("has exactly the same leaf paths (objects, arrays and array lengths)", () => {
    const missingInId = [...enLeaves.keys()].filter((p) => !idLeaves.has(p));
    const extraInId = [...idLeaves.keys()].filter((p) => !enLeaves.has(p));
    expect(missingInId, "paths present in en but missing in id").toEqual([]);
    expect(extraInId, "paths present in id but missing in en").toEqual([]);
  });

  it("uses identical {placeholder} sets for every string", () => {
    const mismatches: string[] = [];
    for (const [path, enValue] of enLeaves) {
      const idValue = idLeaves.get(path);
      if (idValue === undefined) continue; // reported by the parity test above
      const a = placeholders(enValue);
      const b = placeholders(idValue);
      if (a.join(",") !== b.join(",")) {
        mismatches.push(`${path}: en {${a.join(",")}} vs id {${b.join(",")}}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe.each([
  ["en", enLeaves],
  ["id", idLeaves],
] as const)("%s content rules", (_locale, leaves) => {
  it("has no empty or untrimmed strings", () => {
    const bad = [...leaves].filter(([, v]) => v.trim().length === 0 || v !== v.trim());
    expect(bad.map(([p]) => p)).toEqual([]);
  });

  it("contains no forbidden phrases", () => {
    const hits: string[] = [];
    for (const [path, value] of leaves) {
      const lower = value.toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) {
        if (lower.includes(phrase)) hits.push(`${path} contains "${phrase}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps copy in sentence case except tiny mono labels", () => {
    const shouting = [...leaves]
      .filter(([path, value]) => isAllCaps(value) && !ALL_CAPS_ALLOWED.some((re) => re.test(path)))
      .map(([path, value]) => `${path} = "${value}"`);
    expect(shouting).toEqual([]);
  });

  it("has well-formed placeholders (no stray braces)", () => {
    const bad = [...leaves]
      .filter(([, v]) => v.replace(/\{\w+\}/g, "").includes("{") || v.replace(/\{\w+\}/g, "").includes("}"))
      .map(([p]) => p);
    expect(bad).toEqual([]);
  });
});

describe("shared key contract", () => {
  it("has a nav label for every NAV_ITEMS id", () => {
    for (const item of NAV_ITEMS) {
      expect(typeof en.nav[item.id]).toBe("string");
      expect(typeof id.nav[item.id]).toBe("string");
    }
  });

  it("has a validation message for every ValidationErrorCode", () => {
    const codes = [
      "required",
      "invalid_email",
      "invalid_phone",
      "too_short",
      "too_long",
      "invalid_pair",
      "invalid_amount",
      "amount_too_small",
      "amount_too_large",
      "consent_required",
      "invalid_value",
    ] as const;
    for (const code of codes) {
      expect(en.validation[code].length).toBeGreaterThan(0);
      expect(id.validation[code].length).toBeGreaterThan(0);
    }
  });

  it("has a form error message for every non-validation API error code", () => {
    const codes = ["rate_limited", "delivery_failed", "network_error", "spam_detected", "unknown"] as const;
    for (const code of codes) {
      expect(en.form.errors[code].length).toBeGreaterThan(0);
      expect(id.form.errors[code].length).toBeGreaterThan(0);
    }
  });

  it("keeps the disclaimer wording identical wherever it is repeated", () => {
    for (const dict of [en, id]) {
      expect(dict.rateChecker.disclaimer).toBe(dict.disclaimer.short);
      expect(dict.exchangeRequest.disclaimer).toBe(dict.disclaimer.formRate);
    }
  });

  it("carries the config-driven {spread} placeholder where the 5% appears", () => {
    for (const dict of [en, id]) {
      expect(dict.common.spreadBadge).toContain("{spread}");
      expect(dict.common.ourRateFormula).toContain("{spread}");
      expect(dict.rateChecker.spreadBadge).toContain("{spread}");
      expect(dict.pairs.ourRateFormula).toContain("{spread}");
      expect(dict.disclaimer.full).toContain("{spread}");
      expect(dict.faq.items.some((i) => i.question.includes("{spread}"))).toBe(true);
    }
  });

  it("has the fixed list sizes the sections render", () => {
    for (const dict of [en, id]) {
      expect(dict.hero.supporting).toHaveLength(3);
      expect(dict.hero.processSteps).toHaveLength(4);
      expect(dict.howItWorks.steps).toHaveLength(4);
      expect(dict.whyChooseUs.items).toHaveLength(4);
      expect(dict.security.items).toHaveLength(6);
      expect(dict.faq.items).toHaveLength(8);
    }
  });

  it("interpolates placeholders", () => {
    expect(interpolate(en.common.spreadBadge, { spread: "5%" })).toBe("+5% FROM MARKET");
    expect(interpolate(id.common.ourRateFormula, { spread: "5%" })).toBe("HARGA PASAR + 5%");
    expect(interpolate(en.footer.copyright, { year: 2026, brand: "Cryptix" })).toBe(
      "© 2026 Cryptix. All rights reserved.",
    );
  });
});
