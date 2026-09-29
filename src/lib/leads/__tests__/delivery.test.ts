// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactLead, ExchangeRequestLead } from "@/lib/leads/types";

/** Mutable server config; delivery.ts reads it at call time, so tests can flip channels. */
const mockConfig = vi.hoisted(() => ({
  serverConfig: {
    isProduction: false,
    exchange: { spread: 0.05 },
    market: {},
    leads: {
      contactEmail: "team@example.com" as string | undefined,
      webhookUrl: undefined as string | undefined,
      webhookSecret: undefined as string | undefined,
      resendApiKey: undefined as string | undefined,
      resendFrom: undefined as string | undefined,
    },
    security: { formRateLimitMax: 5, formRateLimitWindowMs: 600_000, formMinFillTimeMs: 2_500 },
  },
}));
vi.mock("@/config/server", () => mockConfig);

import { deliverLead, LEAD_SIGNATURE_HEADER, RESEND_API_URL, signWebhookBody } from "@/lib/leads/delivery";

const contactLead: ContactLead = {
  type: "contact",
  reference: "CX-ABC234",
  receivedAt: "2026-09-29T01:02:03.000Z",
  locale: "en",
  ipHash: "0123456789abcdef",
  userAgent: "Mozilla/5.0 (test)",
  name: "John <script>alert(1)</script> Doe",
  email: "john.doe@example.com",
  whatsapp: "+6281234567890",
  subject: "Rate & terms",
  message: "First line\nSecond line",
};

const exchangeLead: ExchangeRequestLead = {
  type: "exchange_request",
  reference: "CX-XYZ789",
  receivedAt: "2026-09-29T01:02:03.000Z",
  locale: "id",
  ipHash: "fedcba9876543210",
  userAgent: "",
  fullName: "Siti Aminah",
  whatsapp: "+6281234567890",
  email: "siti@example.com",
  pairId: "USDT_BTC",
  from: "USDT",
  to: "BTC",
  amount: 1000,
  estimatedReceive: 0.0095,
  message: null,
  consent: true,
};

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function okFetch(status = 200): FetchMock {
  return vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status })) as unknown as FetchMock;
}

/** A fetch that never resolves until its signal aborts (for the timeout test). */
function hangingFetch(): FetchMock {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  ) as unknown as FetchMock;
}

function calledWith(fetchImpl: FetchMock, index = 0): { url: string; init: RequestInit } {
  const call = fetchImpl.mock.calls[index] as [string, RequestInit];
  return { url: call[0], init: call[1] };
}

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

beforeEach(() => {
  mockConfig.serverConfig.isProduction = false;
  mockConfig.serverConfig.leads.contactEmail = "team@example.com";
  mockConfig.serverConfig.leads.webhookUrl = undefined;
  mockConfig.serverConfig.leads.webhookSecret = undefined;
  mockConfig.serverConfig.leads.resendApiKey = undefined;
  mockConfig.serverConfig.leads.resendFrom = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deliverLead — no external channel", () => {
  it("counts the console as delivered, warns, and never calls fetch", async () => {
    const fetchImpl = okFetch();
    const logger = makeLogger();
    const result = await deliverLead(contactLead, { fetchImpl, logger });
    expect(result).toEqual({ delivered: true, channels: ["console"], errors: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(String(logger.warn.mock.calls[0][0])).toContain("No delivery channel configured");
  });

  it("logs a redacted one-line summary (no raw email/phone/name) and the full text only in development", async () => {
    const logger = makeLogger();
    await deliverLead(contactLead, { fetchImpl: okFetch(), logger });
    const summary = String(logger.info.mock.calls[0][0]);
    expect(summary).toContain("[lead] delivered");
    expect(summary).toContain("ref=CX-ABC234");
    expect(summary).toContain("email=j***@example.com");
    expect(summary).toContain("whatsapp=+62*******7890");
    expect(summary).not.toContain("john.doe@example.com");
    expect(summary).not.toContain("6281234567890");
    expect(summary).not.toContain("John");
    // Development convenience: the second info line carries the full text.
    const full = String(logger.info.mock.calls[1][0]);
    expect(full).toContain("development only");
    expect(full).toContain("john.doe@example.com");
  });

  it("in production nothing logged contains the raw email or phone, and console-only is NOT a delivery", async () => {
    mockConfig.serverConfig.isProduction = true;
    const logger = makeLogger();
    const result = await deliverLead(contactLead, { fetchImpl: okFetch(), logger });
    const everything = [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]
      .map((c) => String(c[0]))
      .join("\n");
    expect(everything).not.toContain("john.doe@example.com");
    expect(everything).not.toContain("6281234567890");
    expect(everything).not.toContain("John");
    // No external channel in production → the lead is NOT considered delivered (route answers 500).
    expect(result.delivered).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("NO DELIVERY CHANNEL CONFIGURED IN PRODUCTION"));
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe("deliverLead — webhook", () => {
  it("POSTs a signed JSON payload when a secret is configured", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    mockConfig.serverConfig.leads.webhookSecret = "s3cret";
    const fetchImpl = okFetch();
    const result = await deliverLead(exchangeLead, { fetchImpl, logger: makeLogger() });
    expect(result).toEqual({ delivered: true, channels: ["webhook", "console"], errors: [] });

    const { url, init } = calledWith(fetchImpl);
    expect(url).toBe("https://hooks.example.com/leads");
    expect(init.method).toBe("POST");
    const headers = headersOf(init);
    expect(headers["Content-Type"]).toContain("application/json");
    expect(headers["X-Lead-Reference"]).toBe("CX-XYZ789");
    expect(headers[LEAD_SIGNATURE_HEADER]).toBe(signWebhookBody(String(init.body), "s3cret"));
    expect(headers[LEAD_SIGNATURE_HEADER]).toMatch(/^[0-9a-f]{64}$/);

    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      event: "lead.received",
      type: "exchange_request",
      reference: "CX-XYZ789",
      locale: "id",
      lead: { pairId: "USDT_BTC", amount: 1000, from: "USDT", to: "BTC", email: "siti@example.com" },
    });
    // Customer-locale amount plus the raw number, so 1.000 vs 1,000 is never ambiguous.
    expect(payload.text).toContain("Amount to send: 1.000 USDT (1000)");
    expect(payload.text).toContain("Estimated receive (indicative): 0,0095 BTC (0.0095)");
  });

  it("omits the signature header without a secret", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    const fetchImpl = okFetch();
    await deliverLead(contactLead, { fetchImpl, logger: makeLogger() });
    expect(headersOf(calledWith(fetchImpl).init)[LEAD_SIGNATURE_HEADER]).toBeUndefined();
  });

  it("reports an HTTP failure and marks the lead undelivered", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    const logger = makeLogger();
    const result = await deliverLead(contactLead, { fetchImpl: okFetch(503), logger });
    expect(result).toEqual({ delivered: false, channels: ["console"], errors: ["webhook: HTTP 503"] });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(String(logger.error.mock.calls[0][0])).toContain("delivery_failed");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("times out and reports it", async () => {
    vi.useFakeTimers();
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    const pending = deliverLead(contactLead, { fetchImpl: hangingFetch(), timeoutMs: 100, logger: makeLogger() });
    await vi.advanceTimersByTimeAsync(150);
    const result = await pending;
    expect(result.delivered).toBe(false);
    expect(result.errors).toEqual(["webhook: timeout after 100ms"]);
  });

  it("maps a thrown network error to a safe message", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed\nsecret=abc");
    }) as unknown as FetchMock;
    const result = await deliverLead(contactLead, { fetchImpl, logger: makeLogger() });
    expect(result.errors).toEqual(["webhook: fetch failed\\nsecret=abc"]);
  });
});

describe("deliverLead — email via Resend", () => {
  it("sends plain text + escaped HTML to the contact email with the customer as reply-to", async () => {
    mockConfig.serverConfig.leads.resendApiKey = "re_test_123";
    mockConfig.serverConfig.leads.resendFrom = "Cryptix <leads@example.com>";
    const fetchImpl = okFetch();
    const result = await deliverLead(contactLead, { fetchImpl, logger: makeLogger() });
    expect(result).toEqual({ delivered: true, channels: ["email", "console"], errors: [] });

    const { url, init } = calledWith(fetchImpl);
    expect(url).toBe(RESEND_API_URL);
    expect(headersOf(init).Authorization).toBe("Bearer re_test_123");
    const payload = JSON.parse(String(init.body));
    expect(payload.from).toBe("Cryptix <leads@example.com>");
    expect(payload.to).toEqual(["team@example.com"]);
    expect(payload.reply_to).toBe("john.doe@example.com");
    expect(payload.subject).toContain("CX-ABC234");
    expect(payload.subject).toContain("Rate & terms");
    expect(payload.text).toContain("Name: John <script>alert(1)</script> Doe");
    expect(payload.text).toContain("Message:\nFirst line\nSecond line");
    expect(payload.html).toContain("John &lt;script&gt;alert(1)&lt;/script&gt; Doe");
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("First line<br>Second line");
    expect(payload.html).toContain("Rate &amp; terms");
  });

  it("fails clearly when the key is set but sender or recipient is missing", async () => {
    mockConfig.serverConfig.leads.resendApiKey = "re_test_123";
    mockConfig.serverConfig.leads.contactEmail = undefined;
    const fetchImpl = okFetch();
    const result = await deliverLead(contactLead, { fetchImpl, logger: makeLogger() });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
    expect(result.errors).toEqual(["email: RESEND_FROM_EMAIL or CONTACT_EMAIL missing"]);
  });

  it("reports a rejected API call", async () => {
    mockConfig.serverConfig.leads.resendApiKey = "re_test_123";
    mockConfig.serverConfig.leads.resendFrom = "leads@example.com";
    const result = await deliverLead(contactLead, { fetchImpl: okFetch(422), logger: makeLogger() });
    expect(result).toEqual({ delivered: false, channels: ["console"], errors: ["email: HTTP 422"] });
  });
});

describe("deliverLead — channels are independent", () => {
  it("is delivered when the webhook fails but the email succeeds", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    mockConfig.serverConfig.leads.resendApiKey = "re_test_123";
    mockConfig.serverConfig.leads.resendFrom = "leads@example.com";
    const fetchImpl = vi.fn(async (url: string) =>
      url === RESEND_API_URL ? new Response("{}", { status: 200 }) : new Response("nope", { status: 500 }),
    ) as unknown as FetchMock;
    const logger = makeLogger();
    const result = await deliverLead(exchangeLead, { fetchImpl, logger });
    expect(result).toEqual({ delivered: true, channels: ["email", "console"], errors: ["webhook: HTTP 500"] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(logger.info.mock.calls[0][0])).toContain('errors="webhook: HTTP 500"');
    // Nothing else is configured-less, so no "no channel" warning and no dev dump.
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("is undelivered when both external channels fail", async () => {
    mockConfig.serverConfig.leads.webhookUrl = "https://hooks.example.com/leads";
    mockConfig.serverConfig.leads.resendApiKey = "re_test_123";
    mockConfig.serverConfig.leads.resendFrom = "leads@example.com";
    const result = await deliverLead(exchangeLead, { fetchImpl: okFetch(500), logger: makeLogger() });
    expect(result.delivered).toBe(false);
    expect(result.channels).toEqual(["console"]);
    expect(result.errors).toEqual(["webhook: HTTP 500", "email: HTTP 500"]);
  });
});
