// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getClientIp, hashClientIp, UNKNOWN_IP } from "@/lib/security/client-ip";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/contact", { method: "POST", headers });
}

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
    expect(getClientIp(req({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip then cf-connecting-ip", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.4", "cf-connecting-ip": "192.0.2.9" }))).toBe("198.51.100.4");
    expect(getClientIp(req({ "cf-connecting-ip": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  it("returns 'unknown' without any usable header", () => {
    expect(getClientIp(req({}))).toBe(UNKNOWN_IP);
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe(UNKNOWN_IP);
  });

  it("strips ports and IPv6 brackets", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7:51234" }))).toBe("203.0.113.7");
    expect(getClientIp(req({ "x-forwarded-for": "[2001:db8::1]:443" }))).toBe("2001:db8::1");
    expect(getClientIp(req({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("skips garbage and continues down the chain", () => {
    expect(getClientIp(req({ "x-forwarded-for": "<script>alert(1)</script>", "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
    expect(getClientIp(req({ "x-forwarded-for": "a".repeat(100) }))).toBe(UNKNOWN_IP);
  });
});

describe("hashClientIp", () => {
  it("is deterministic, 16 hex characters, and not the input", () => {
    const a = hashClientIp("203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).toBe(hashClientIp("203.0.113.7"));
    expect(a).not.toBe(hashClientIp("203.0.113.8"));
    expect(a).not.toContain("203");
  });
});
