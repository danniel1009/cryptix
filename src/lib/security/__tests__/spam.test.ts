import { describe, expect, it } from "vitest";
import { collectTextFields, countUrls, isLikelySpam } from "@/lib/security/spam";

const NOW = 1_700_000_000_000;
const base = { now: NOW, ts: NOW - 60_000, minFillTimeMs: 2_500 };

describe("isLikelySpam", () => {
  it("passes a normal message", () => {
    expect(
      isLikelySpam({ ...base, hp: "", text: "Hello, I want to exchange 1,000 USDT to BTC. What is the current rate?" }),
    ).toEqual({ spam: false });
  });

  it("flags a filled honeypot regardless of anything else", () => {
    expect(isLikelySpam({ ...base, hp: "http://x", text: "hi" })).toEqual({ spam: true, reason: "honeypot" });
    expect(isLikelySpam({ ...base, hp: "  x " })).toEqual({ spam: true, reason: "honeypot" });
    expect(isLikelySpam({ ...base, hp: 1 })).toEqual({ spam: true, reason: "honeypot" });
    expect(isLikelySpam({ ...base, hp: "   " })).toEqual({ spam: false });
    expect(isLikelySpam({ ...base, hp: null })).toEqual({ spam: false });
  });

  it("flags a submission faster than minFillTimeMs", () => {
    expect(isLikelySpam({ now: NOW, ts: NOW - 500, minFillTimeMs: 2_500 })).toEqual({ spam: true, reason: "too_fast" });
    expect(isLikelySpam({ now: NOW, ts: NOW - 2_500, minFillTimeMs: 2_500 })).toEqual({ spam: false });
  });

  it("never judges timing when ts is missing, invalid, or the client clock is ahead", () => {
    expect(isLikelySpam({ now: NOW, minFillTimeMs: 2_500 })).toEqual({ spam: false });
    expect(isLikelySpam({ now: NOW, ts: "yesterday", minFillTimeMs: 2_500 })).toEqual({ spam: false });
    expect(isLikelySpam({ now: NOW, ts: Number.NaN, minFillTimeMs: 2_500 })).toEqual({ spam: false });
    expect(isLikelySpam({ now: NOW, ts: NOW + 90_000, minFillTimeMs: 2_500 })).toEqual({ spam: false });
    expect(isLikelySpam({ now: NOW, ts: NOW - 100, minFillTimeMs: 0 })).toEqual({ spam: false });
  });

  it("flags more than 3 URLs but allows 3", () => {
    const three = "see https://a.com and http://b.org/x and www.c.net";
    expect(isLikelySpam({ ...base, text: three })).toEqual({ spam: false });
    expect(isLikelySpam({ ...base, text: `${three} plus https://d.io` })).toEqual({
      spam: true,
      reason: "too_many_urls",
    });
    expect(isLikelySpam({ ...base, text: three, maxUrls: 2 })).toEqual({ spam: true, reason: "too_many_urls" });
  });

  it("flags excessive repetition of a character or a word", () => {
    expect(isLikelySpam({ ...base, text: "hellooooooooooo there" })).toEqual({
      spam: true,
      reason: "repeated_characters",
    });
    expect(isLikelySpam({ ...base, text: "wow!!!!!!!!!!" })).toEqual({ spam: true, reason: "repeated_characters" });
    expect(isLikelySpam({ ...base, text: "buy buy buy buy buy buy now" })).toEqual({
      spam: true,
      reason: "repeated_characters",
    });
    expect(isLikelySpam({ ...base, text: "hellooo there!!! buy buy" })).toEqual({ spam: false });
  });

  it("flags known spam patterns", () => {
    for (const text of [
      "Cheap viagra available",
      "We offer SEO services for your website",
      "Get quality backlinks today",
      "Make money fast with this trick",
      "Click here to claim your prize",
      "[url=http://x]link[/url]",
      '<a href="http://x">x</a>',
      "Buy followers for your account",
      "Free bitcoin for everyone",
      "Double your BTC in 24 hours",
      "Join our giveaway",
      "We provide website development at low prices",
    ]) {
      expect(isLikelySpam({ ...base, text }), text).toEqual({ spam: true, reason: "spam_pattern" });
    }
  });

  it("does not flag ordinary crypto-desk vocabulary", () => {
    for (const text of [
      "I would like to exchange bitcoin for USDT, what is your rate?",
      "Is the market price plus 5% the final rate or indicative?",
      "How long does an ETH to BTC exchange usually take?",
      "Can I send 50,000,000 IDR worth of USDT? Please contact me on WhatsApp.",
      "My reference is CX-7KQ2MZ, I have not heard back yet.",
    ]) {
      expect(isLikelySpam({ ...base, text }), text).toEqual({ spam: false });
    }
  });

  it("honeypot beats timing, timing beats text", () => {
    expect(isLikelySpam({ now: NOW, ts: NOW, hp: "x", text: "casino" }).reason).toBe("honeypot");
    expect(isLikelySpam({ now: NOW, ts: NOW, hp: "", text: "casino" }).reason).toBe("too_fast");
  });
});

describe("helpers", () => {
  it("countUrls counts http, https and www links", () => {
    expect(countUrls("none")).toBe(0);
    expect(countUrls("https://a.com http://b.com www.c.com HTTPS://D.COM")).toBe(4);
    expect(countUrls("https://a.com https://a.com")).toBe(2);
  });

  it("collectTextFields joins string fields only", () => {
    const body = { name: "A", message: "B", amount: 5, hp: "", nested: { x: "y" }, email: "c@d.e" };
    expect(collectTextFields(body)).toBe("A\nB\nc@d.e");
    expect(collectTextFields(body, ["message", "missing", "amount"])).toBe("B");
  });
});
