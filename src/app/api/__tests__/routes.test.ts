// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({
  serverConfig: {
    isProduction: false,
    exchange: { spread: 0.05 },
    market: {},
    leads: {
      contactEmail: "team@example.com",
      webhookUrl: undefined,
      webhookSecret: undefined,
      resendApiKey: undefined,
      resendFrom: undefined,
    },
    security: { formRateLimitMax: 3, formRateLimitWindowMs: 60_000, formMinFillTimeMs: 2_500 },
  },
}));
vi.mock("@/config/server", () => mockConfig);
vi.mock("@/lib/leads/delivery", () => ({ deliverLead: vi.fn() }));

import { deliverLead } from "@/lib/leads/delivery";
import type { ContactLead, ExchangeRequestLead, LeadDeliveryResult } from "@/lib/leads/types";
import * as contactRoute from "@/app/api/contact/route";
import * as exchangeRoute from "@/app/api/exchange-request/route";

const deliverLeadMock = vi.mocked(deliverLead);
const REFERENCE = /^CX-[A-HJ-NP-Z2-9]{6}$/;

/** Each test gets its own IP so the module-level rate limiters never interfere. */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}.1`;
}

interface PostOptions {
  ip?: string;
  headers?: Record<string, string>;
  raw?: string;
}

function post(path: string, body: unknown, options: PostOptions = {}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": options.ip ?? nextIp(),
    "user-agent": "vitest/1.0",
    ...options.headers,
  };
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: options.raw ?? JSON.stringify(body),
  });
}

const validContact = () => ({
  name: "Jane Doe",
  email: "jane@example.com",
  whatsapp: "+62 812-3456-7890",
  subject: "Question about rates",
  message: "Hello, I would like to ask about a larger exchange.",
  hp: "",
  ts: Date.now() - 10_000,
  locale: "id",
});

const validExchange = () => ({
  fullName: "Jane Doe",
  whatsapp: "+62 812-3456-7890",
  email: "jane@example.com",
  pairId: "USDT_BTC",
  amount: 1000,
  estimatedReceive: 0.0095,
  message: "",
  consent: true,
  hp: "",
  ts: Date.now() - 10_000,
  locale: "en",
});

const delivered: LeadDeliveryResult = { delivered: true, channels: ["console"], errors: [] };

beforeEach(() => {
  deliverLeadMock.mockReset();
  deliverLeadMock.mockResolvedValue(delivered);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("happy path: 200 with a reference, no-store, and a sanitised lead delivered", async () => {
    const res = await contactRoute.POST(post("/api/contact", validContact()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reference).toMatch(REFERENCE);

    expect(deliverLeadMock).toHaveBeenCalledTimes(1);
    const lead = deliverLeadMock.mock.calls[0][0] as ContactLead;
    expect(lead).toMatchObject({
      type: "contact",
      reference: body.reference,
      locale: "id",
      userAgent: "vitest/1.0",
      name: "Jane Doe",
      email: "jane@example.com",
      whatsapp: "+6281234567890",
      subject: "Question about rates",
    });
    expect(lead.ipHash).toMatch(/^[0-9a-f]{16}$/);
    expect(Number.isNaN(Date.parse(lead.receivedAt))).toBe(false);
  });

  it("resolves the locale from Accept-Language when the body has none", async () => {
    const noLocale: Record<string, unknown> = { ...validContact() };
    delete noLocale.locale;
    await contactRoute.POST(post("/api/contact", noLocale, { headers: { "accept-language": "id-ID,id;q=0.9,en;q=0.8" } }));
    expect((deliverLeadMock.mock.calls[0][0] as ContactLead).locale).toBe("id");
  });

  it("returns 400 with per-field codes and delivers nothing", async () => {
    const res = await contactRoute.POST(post("/api/contact", { name: "J", email: "nope", ts: Date.now() - 10_000 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "validation_error",
      errors: {
        name: "too_short",
        email: "invalid_email",
        whatsapp: "required",
        subject: "required",
        message: "required",
      },
    });
    expect(deliverLeadMock).not.toHaveBeenCalled();
  });

  it("honeypot: pretends success but never delivers", async () => {
    const res = await contactRoute.POST(post("/api/contact", { ...validContact(), hp: "http://spam.example" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reference).toMatch(REFERENCE);
    expect(deliverLeadMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("spam_detected reason=honeypot"));
  });

  it("too-fast submission is a weak signal: delivered, but flagged as suspicious", async () => {
    const res = await contactRoute.POST(post("/api/contact", { ...validContact(), ts: Date.now() }));
    expect(res.status).toBe(200);
    expect(deliverLeadMock).toHaveBeenCalledTimes(1);
    expect(deliverLeadMock.mock.calls[0][0]).toMatchObject({ suspicious: true });
  });

  it("rate limits the 4th request from one IP with 429 + Retry-After", async () => {
    const ip = nextIp();
    for (let i = 0; i < 3; i += 1) {
      const res = await contactRoute.POST(post("/api/contact", validContact(), { ip }));
      expect(res.status).toBe(200);
    }
    const blocked = await contactRoute.POST(post("/api/contact", validContact(), { ip }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    const body = await blocked.json();
    expect(body).toMatchObject({ ok: false, code: "rate_limited" });
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(deliverLeadMock).toHaveBeenCalledTimes(3);
    // A different IP is unaffected.
    expect((await contactRoute.POST(post("/api/contact", validContact()))).status).toBe(200);
  });

  it("rate limiting happens before validation (invalid bodies still count)", async () => {
    const ip = nextIp();
    for (let i = 0; i < 3; i += 1) {
      expect((await contactRoute.POST(post("/api/contact", {}, { ip }))).status).toBe(400);
    }
    expect((await contactRoute.POST(post("/api/contact", {}, { ip }))).status).toBe(429);
  });

  it("returns 400 bad_request for invalid JSON and non-object bodies", async () => {
    const invalid = await contactRoute.POST(post("/api/contact", null, { raw: "{not json" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, code: "bad_request", reason: "invalid_json" });

    const array = await contactRoute.POST(post("/api/contact", [1, 2, 3]));
    expect(array.status).toBe(400);
    expect(await array.json()).toEqual({ ok: false, code: "bad_request", reason: "invalid_body" });

    const nul = await contactRoute.POST(post("/api/contact", null, { raw: "null" }));
    expect(await nul.json()).toEqual({ ok: false, code: "bad_request", reason: "invalid_body" });
    expect(deliverLeadMock).not.toHaveBeenCalled();
  });

  it("rejects bodies over 32 KB with 413", async () => {
    const huge = { ...validContact(), message: "x".repeat(40_000) };
    const res = await contactRoute.POST(post("/api/contact", huge));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, code: "payload_too_large" });
    expect(deliverLeadMock).not.toHaveBeenCalled();
  });

  it("returns 500 delivery_failed when no channel accepted the lead", async () => {
    deliverLeadMock.mockResolvedValue({ delivered: false, channels: ["console"], errors: ["webhook: HTTP 500"] });
    const res = await contactRoute.POST(post("/api/contact", validContact()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: "delivery_failed" });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("delivery_failed"));
  });

  it("answers 405 with an Allow header for other methods", async () => {
    for (const handler of [contactRoute.GET, contactRoute.PUT, contactRoute.PATCH, contactRoute.DELETE]) {
      const res = handler();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
      expect(await res.json()).toEqual({ ok: false, code: "method_not_allowed" });
    }
  });

  it("never logs raw user input", async () => {
    await contactRoute.POST(post("/api/contact", { ...validContact(), hp: "spam", name: "SECRET-NAME" }));
    const logged = [
      ...vi.mocked(console.warn).mock.calls,
      ...vi.mocked(console.error).mock.calls,
      ...vi.mocked(console.info).mock.calls,
    ]
      .map((c) => String(c[0]))
      .join("\n");
    expect(logged).not.toContain("SECRET-NAME");
    expect(logged).not.toContain("jane@example.com");
  });
});

describe("POST /api/exchange-request", () => {
  it("happy path: builds a full exchange lead", async () => {
    const res = await exchangeRoute.POST(post("/api/exchange-request", validExchange()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reference).toMatch(REFERENCE);

    const lead = deliverLeadMock.mock.calls[0][0] as ExchangeRequestLead;
    expect(lead).toMatchObject({
      type: "exchange_request",
      reference: body.reference,
      locale: "en",
      fullName: "Jane Doe",
      whatsapp: "+6281234567890",
      email: "jane@example.com",
      pairId: "USDT_BTC",
      from: "USDT",
      to: "BTC",
      amount: 1000,
      estimatedReceive: 0.0095,
      message: null,
      consent: true,
    });
  });

  it("returns 400 for an unsupported pair, a missing consent and an out-of-range amount", async () => {
    const res = await exchangeRoute.POST(
      post("/api/exchange-request", { ...validExchange(), pairId: "ETH_SOL", consent: false }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "validation_error",
      errors: { pairId: "invalid_pair", consent: "consent_required" },
    });

    const small = await exchangeRoute.POST(post("/api/exchange-request", { ...validExchange(), amount: 1 }));
    expect((await small.json()).errors).toEqual({ amount: "amount_too_small" });
    expect(deliverLeadMock).not.toHaveBeenCalled();
  });

  it("honeypot: pretends success but never delivers", async () => {
    const res = await exchangeRoute.POST(post("/api/exchange-request", { ...validExchange(), hp: "bot" }));
    expect(res.status).toBe(200);
    expect((await res.json()).reference).toMatch(REFERENCE);
    expect(deliverLeadMock).not.toHaveBeenCalled();
  });

  it("rate limits after 3 requests from one IP", async () => {
    const ip = nextIp();
    for (let i = 0; i < 3; i += 1) {
      expect((await exchangeRoute.POST(post("/api/exchange-request", validExchange(), { ip }))).status).toBe(200);
    }
    const blocked = await exchangeRoute.POST(post("/api/exchange-request", validExchange(), { ip }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await exchangeRoute.POST(post("/api/exchange-request", null, { raw: "<xml/>" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, code: "bad_request", reason: "invalid_json" });
  });

  it("returns 500 delivery_failed when delivery fails", async () => {
    deliverLeadMock.mockResolvedValue({ delivered: false, channels: ["console"], errors: ["email: HTTP 500"] });
    const res = await exchangeRoute.POST(post("/api/exchange-request", validExchange()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: "delivery_failed" });
  });

  it("answers 405 for other methods", () => {
    expect(exchangeRoute.GET().status).toBe(405);
    expect(exchangeRoute.PUT().status).toBe(405);
    expect(exchangeRoute.PATCH().status).toBe(405);
    expect(exchangeRoute.DELETE().status).toBe(405);
  });

  it("exports Next route segment config", () => {
    expect(exchangeRoute.dynamic).toBe("force-dynamic");
    expect(contactRoute.dynamic).toBe("force-dynamic");
  });
});
