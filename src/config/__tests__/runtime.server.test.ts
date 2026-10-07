// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimePublicConfig } from "@/config/runtime.server";

const ALL = ["WHATSAPP_NUMBER", "NEXT_PUBLIC_WHATSAPP_NUMBER", "PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_CONTACT_EMAIL"] as const;

beforeEach(() => {
  // Blank every input first so the developer's shell / .env never leaks into an assertion.
  for (const name of ALL) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRuntimePublicConfig", () => {
  it("returns '' for both when nothing is set", () => {
    expect(getRuntimePublicConfig()).toEqual({ whatsappNumber: "", contactEmail: "" });
  });

  it("prefers WHATSAPP_NUMBER over NEXT_PUBLIC_WHATSAPP_NUMBER", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "6282317600972");
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "6281234567890");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6282317600972");
  });

  it("falls back to NEXT_PUBLIC_WHATSAPP_NUMBER when WHATSAPP_NUMBER is unset or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "6281234567890");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6281234567890");

    vi.stubEnv("WHATSAPP_NUMBER", "   ");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6281234567890");
  });

  it("normalises '+62 823-1760-0972' → '6282317600972' (digits only)", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "+62 823-1760-0972");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6282317600972");

    vi.stubEnv("WHATSAPP_NUMBER", "6282317600972");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6282317600972");
  });

  it("normalises the NEXT_PUBLIC_ fallback too", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "+62 812-3456-7890");
    expect(getRuntimePublicConfig().whatsappNumber).toBe("6281234567890");
  });

  it("prefers PUBLIC_CONTACT_EMAIL over NEXT_PUBLIC_CONTACT_EMAIL and trims it", () => {
    vi.stubEnv("PUBLIC_CONTACT_EMAIL", "  hello@example.com  ");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "build@example.com");
    expect(getRuntimePublicConfig().contactEmail).toBe("hello@example.com");
  });

  it("falls back to NEXT_PUBLIC_CONTACT_EMAIL when PUBLIC_CONTACT_EMAIL is unset or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", " build@example.com ");
    expect(getRuntimePublicConfig().contactEmail).toBe("build@example.com");

    vi.stubEnv("PUBLIC_CONTACT_EMAIL", "");
    expect(getRuntimePublicConfig().contactEmail).toBe("build@example.com");
  });

  it("reads the environment on EVERY call — no module-level cache (restart is all an operator needs)", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "6281234567890");
    vi.stubEnv("PUBLIC_CONTACT_EMAIL", "old@example.com");
    expect(getRuntimePublicConfig()).toEqual({ whatsappNumber: "6281234567890", contactEmail: "old@example.com" });

    vi.stubEnv("WHATSAPP_NUMBER", "6282317600972");
    vi.stubEnv("PUBLIC_CONTACT_EMAIL", "new@example.com");
    expect(getRuntimePublicConfig()).toEqual({ whatsappNumber: "6282317600972", contactEmail: "new@example.com" });

    vi.stubEnv("WHATSAPP_NUMBER", "");
    vi.stubEnv("PUBLIC_CONTACT_EMAIL", "");
    expect(getRuntimePublicConfig()).toEqual({ whatsappNumber: "", contactEmail: "" });
  });

  it("returns a fresh object per call (callers may not mutate shared state)", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "6282317600972");
    const a = getRuntimePublicConfig();
    const b = getRuntimePublicConfig();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
