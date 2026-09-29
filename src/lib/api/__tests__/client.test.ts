// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_ENDPOINT,
  EXCHANGE_REQUEST_ENDPOINT,
  mapSubmitResponse,
  submitContact,
  submitExchangeRequest,
} from "@/lib/api/client";
import type { ContactInput, ExchangeRequestInput } from "@/lib/validation/schemas";

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function jsonFetch(status: number, body: unknown, headers: Record<string, string> = {}): FetchMock {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }),
  ) as unknown as FetchMock;
}

const contact: ContactInput = {
  name: "Jane",
  email: "jane@example.com",
  whatsapp: "+6281234567890",
  subject: "Hello there",
  message: "A message long enough to pass.",
  hp: "",
  ts: 123,
};

const exchange: ExchangeRequestInput = {
  fullName: "Jane",
  whatsapp: "+6281234567890",
  email: "jane@example.com",
  pairId: "USDT_BTC",
  amount: 1000,
  estimatedReceive: 0.0095,
  consent: true,
  hp: "",
  ts: 123,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("submitContact / submitExchangeRequest", () => {
  it("POSTs JSON with the locale in the body and Accept-Language, and returns the reference", async () => {
    const fetchImpl = jsonFetch(200, { ok: true, reference: "CX-ABC234" });
    const result = await submitContact(contact, { locale: "id", fetchImpl });
    expect(result).toEqual({ ok: true, reference: "CX-ABC234" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CONTACT_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toContain("application/json");
    expect(headers["Accept-Language"]).toBe("id");
    expect(JSON.parse(String(init.body))).toEqual({ ...contact, locale: "id" });
  });

  it("targets the exchange endpoint and defaults the locale", async () => {
    const fetchImpl = jsonFetch(200, { ok: true, reference: "CX-ABC234" });
    await submitExchangeRequest(exchange, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(EXCHANGE_REQUEST_ENDPOINT);
    expect(JSON.parse(String(init.body)).locale).toBe("en");
  });

  it("maps a validation error and drops unknown codes", async () => {
    const fetchImpl = jsonFetch(400, {
      ok: false,
      code: "validation_error",
      errors: { email: "invalid_email", amount: "amount_too_small", name: "Some english text" },
    });
    const result = await submitExchangeRequest(exchange, { fetchImpl });
    expect(result).toEqual({
      ok: false,
      code: "validation_error",
      errors: { email: "invalid_email", amount: "amount_too_small" },
    });
  });

  it("maps rate limiting from the body", async () => {
    const fetchImpl = jsonFetch(429, { ok: false, code: "rate_limited", retryAfterSeconds: 42 });
    expect(await submitContact(contact, { fetchImpl })).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 42 });
  });

  it("maps rate limiting from status + Retry-After when the body is unusable", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>429</html>", { status: 429, headers: { "retry-after": "17" } }),
    ) as unknown as FetchMock;
    expect(await submitContact(contact, { fetchImpl })).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 17 });
  });

  it("maps delivery_failed and spam_detected", async () => {
    expect(await submitContact(contact, { fetchImpl: jsonFetch(500, { ok: false, code: "delivery_failed" }) })).toEqual({
      ok: false,
      code: "delivery_failed",
    });
    expect(await submitContact(contact, { fetchImpl: jsonFetch(200, { ok: false, code: "spam_detected" }) })).toEqual({
      ok: false,
      code: "spam_detected",
    });
  });

  it("maps anything unexpected to unknown", async () => {
    expect(await submitContact(contact, { fetchImpl: jsonFetch(502, "Bad gateway") })).toEqual({ ok: false, code: "unknown" });
    expect(await submitContact(contact, { fetchImpl: jsonFetch(200, { ok: true }) })).toEqual({ ok: false, code: "unknown" });
    expect(await submitContact(contact, { fetchImpl: jsonFetch(400, { ok: false, code: "bad_request" }) })).toEqual({
      ok: false,
      code: "unknown",
    });
  });

  it("maps a rejected fetch to network_error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as FetchMock;
    expect(await submitContact(contact, { fetchImpl })).toEqual({ ok: false, code: "network_error" });
  });

  it("times out into network_error", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    ) as unknown as FetchMock;
    const pending = submitContact(contact, { fetchImpl, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toEqual({ ok: false, code: "network_error" });
  });

  it("honours a caller-provided abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    ) as unknown as FetchMock;
    const pending = submitContact(contact, { fetchImpl, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ ok: false, code: "network_error" });
  });
});

describe("mapSubmitResponse", () => {
  it("falls back to a default retry delay", () => {
    const res = new Response(null, { status: 429 });
    expect(mapSubmitResponse(res, { ok: false, code: "rate_limited" })).toEqual({
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: 60,
    });
  });
});
