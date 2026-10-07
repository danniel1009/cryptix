import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * The build-time fallback deliberately HAS a number here: the hook must never
 * reach for it. A provider value of "" means "not configured", full stop.
 */
vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  return { ...actual, siteConfig: { ...actual.siteConfig, whatsappNumber: "6281111111111", contactEmail: "build@example.com" } };
});

import { useContactEmail, useWhatsApp } from "@/hooks/useWhatsApp";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { RuntimeConfigProvider, type RuntimePublicConfig } from "@/providers/RuntimeConfigProvider";

function withProvider(value: RuntimePublicConfig) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <RuntimeConfigProvider value={value}>{children}</RuntimeConfigProvider>;
  }
  return Wrapper;
}

const RUNTIME: RuntimePublicConfig = { whatsappNumber: "6282317600972", contactEmail: "hello@example.com" };

describe("useWhatsApp", () => {
  it("precondition: the build-time fallback is a different, non-empty number", () => {
    expect(buildWhatsAppUrl()).toBe("https://wa.me/6281111111111");
  });

  it("builds links from the provider's number", () => {
    const { result } = renderHook(() => useWhatsApp(), { wrapper: withProvider(RUNTIME) });
    expect(result.current.number).toBe("6282317600972");
    expect(result.current.configured).toBe(true);
    expect(result.current.url()).toBe("https://wa.me/6282317600972");
    expect(result.current.url("hello world")).toBe("https://wa.me/6282317600972?text=hello%20world");
    expect(result.current.url("")).toBe("https://wa.me/6282317600972");
  });

  it("an empty provider number is 'not configured' — it never falls back to siteConfig.whatsappNumber", () => {
    const { result } = renderHook(() => useWhatsApp(), {
      wrapper: withProvider({ whatsappNumber: "", contactEmail: "" }),
    });
    expect(result.current.number).toBe("");
    expect(result.current.configured).toBe(false);
    expect(result.current.url("hello")).toBe("#contact");
    expect(result.current.url()).toBe("#contact");
  });

  it("outside a provider behaves as not configured (no throw)", () => {
    const { result } = renderHook(() => useWhatsApp());
    expect(result.current.configured).toBe(false);
    expect(result.current.url("x")).toBe("#contact");
  });

  it("url() is referentially stable across re-renders (safe in effect / memo deps)", () => {
    const { result, rerender } = renderHook(() => useWhatsApp(), { wrapper: withProvider(RUNTIME) });
    const first = result.current.url;
    rerender();
    expect(result.current.url).toBe(first);
  });

  it("follows the provider when the number changes", () => {
    let value: RuntimePublicConfig = RUNTIME;
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeConfigProvider value={value}>{children}</RuntimeConfigProvider>
    );
    const { result, rerender } = renderHook(() => useWhatsApp(), { wrapper: Wrapper });
    expect(result.current.url("hi")).toBe("https://wa.me/6282317600972?text=hi");

    value = { whatsappNumber: "6281234567890", contactEmail: "" };
    rerender();
    expect(result.current.url("hi")).toBe("https://wa.me/6281234567890?text=hi");
  });
});

describe("useContactEmail", () => {
  it("returns the provider's e-mail", () => {
    const { result } = renderHook(() => useContactEmail(), { wrapper: withProvider(RUNTIME) });
    expect(result.current).toBe("hello@example.com");
  });

  it("returns '' outside a provider and for an empty provider value (never the build-time e-mail)", () => {
    expect(renderHook(() => useContactEmail()).result.current).toBe("");
    const { result } = renderHook(() => useContactEmail(), {
      wrapper: withProvider({ whatsappNumber: "6282317600972", contactEmail: "" }),
    });
    expect(result.current).toBe("");
  });
});
