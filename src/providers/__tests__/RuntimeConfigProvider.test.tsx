import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_RUNTIME_CONFIG,
  RuntimeConfigProvider,
  useRuntimeConfig,
  type RuntimePublicConfig,
} from "@/providers/RuntimeConfigProvider";

const CONFIGURED: RuntimePublicConfig = { whatsappNumber: "6282317600972", contactEmail: "hello@example.com" };

function withProvider(value: RuntimePublicConfig) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <RuntimeConfigProvider value={value}>{children}</RuntimeConfigProvider>;
  }
  return Wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RuntimeConfigProvider / useRuntimeConfig", () => {
  it("outside a provider: both values are '' (nothing configured), nothing thrown, nothing logged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useRuntimeConfig());

    expect(result.current).toEqual({ whatsappNumber: "", contactEmail: "" });
    expect(result.current).toBe(EMPTY_RUNTIME_CONFIG);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("the default is frozen so no consumer can mutate what every other consumer sees", () => {
    expect(Object.isFrozen(EMPTY_RUNTIME_CONFIG)).toBe(true);
  });

  it("inside a provider the hook returns the provided values", () => {
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper: withProvider(CONFIGURED) });
    expect(result.current).toEqual(CONFIGURED);
  });

  it("the nearest provider wins", () => {
    const inner: RuntimePublicConfig = { whatsappNumber: "6281234567890", contactEmail: "" };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeConfigProvider value={CONFIGURED}>
        <RuntimeConfigProvider value={inner}>{children}</RuntimeConfigProvider>
      </RuntimeConfigProvider>
    );
    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });
    expect(result.current).toEqual(inner);
  });

  it("keeps the context value referentially stable across re-renders with equal strings", () => {
    // A fresh object literal per render (what a server component hands down) must not churn consumers.
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeConfigProvider value={{ ...CONFIGURED }}>{children}</RuntimeConfigProvider>
    );
    const { result, rerender } = renderHook(() => useRuntimeConfig(), { wrapper: Wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("re-renders consumers when a value actually changes", () => {
    let value: RuntimePublicConfig = CONFIGURED;
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeConfigProvider value={value}>{children}</RuntimeConfigProvider>
    );
    const { result, rerender } = renderHook(() => useRuntimeConfig(), { wrapper: Wrapper });
    expect(result.current.whatsappNumber).toBe("6282317600972");

    value = { whatsappNumber: "", contactEmail: "desk@example.com" };
    rerender();
    expect(result.current).toEqual({ whatsappNumber: "", contactEmail: "desk@example.com" });
  });
});
