import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ExchangeRequestModal } from "@/components/exchange/ExchangeRequestModal";
import type { PairId } from "@/config/exchange";
import { submitExchangeRequest } from "@/lib/api/client";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { computeIndicativeRates } from "@/lib/market/rates";
import type { MarketQuote, MarketSnapshot, MarketStatus } from "@/lib/market/types";
import { buildGeneralInquiryMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  ExchangeRequestProvider,
  useExchangeRequest,
  type ExchangeRequestPrefill,
} from "@/providers/ExchangeRequestProvider";
import type { MarketConnection, MarketContextValue } from "@/providers/MarketProvider";
import { RuntimeConfigProvider, type RuntimePublicConfig } from "@/providers/RuntimeConfigProvider";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/api/client", () => ({ submitExchangeRequest: vi.fn() }));

/** The WhatsApp CTAs need a configured number: the RUNTIME value from <RuntimeConfigProvider>, never the env. */
const RUNTIME: RuntimePublicConfig = { whatsappNumber: "6281234567890", contactEmail: "" };

/** Swapped per test; read lazily by the mocked `useMarket`. */
const market = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => market.value,
  MarketProvider: ({ children }: { children: ReactNode }) => children,
}));

const submitMock = vi.mocked(submitExchangeRequest);

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-09-29T08:00:00.000Z");
const ISO = NOW.toISOString();
const QUOTES: MarketQuote[] = [
  { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1.2, updatedAt: ISO, source: "exchange" },
  { base: "ETH", quote: "BTC", price: 0.03, change24hPct: -0.4, updatedAt: ISO, source: "exchange" },
  { base: "SOL", quote: "BTC", price: 0.00172, change24hPct: 2.1, updatedAt: ISO, source: "exchange" },
  { base: "USDT", quote: "IDR", price: 16_485, change24hPct: 0.1, updatedAt: ISO, source: "indodax" },
];

function buildMarket(status: MarketStatus = "live", connection: MarketConnection = "live"): MarketContextValue {
  if (status === "unavailable") {
    return {
      snapshot: null,
      connection,
      status,
      lastUpdatedAt: null,
      isStale: false,
      refresh: vi.fn(),
      getRate: () => undefined,
      getQuote: () => undefined,
    };
  }
  const rates = computeIndicativeRates(QUOTES, 0.05);
  const snapshot: MarketSnapshot = {
    status,
    generatedAt: ISO,
    updatedAt: ISO,
    spread: 0.05,
    quotes: QUOTES,
    rates,
    sources: ["exchange", "indodax"],
    error: null,
  };
  return {
    snapshot,
    connection,
    status,
    lastUpdatedAt: NOW,
    isStale: status === "stale",
    refresh: vi.fn(),
    getRate: (pairId: PairId) => rates.find((r) => r.pairId === pairId),
    getQuote: () => undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

const PREFILL: ExchangeRequestPrefill = { pairId: "USDT_BTC", amount: 1000, estimatedReceive: 1000 / 105_000 };
/** What the rate checker passes once it captures the rate it displayed at click time. */
const RATE_SNAPSHOT = {
  marketPriceDisplay: 100_000,
  ourPriceDisplay: 105_000,
  quoteBase: "BTC",
  quoteCurrency: "USDT",
  spread: 0.05,
  capturedAt: "2026-09-29T02:00:00.000Z",
} as const;
const PREFILL_WITH_RATE: ExchangeRequestPrefill = { ...PREFILL, rateSnapshot: { ...RATE_SNAPSHOT } };

const PREFILLS = {
  "open-prefilled": PREFILL,
  "open-prefilled-rate": PREFILL_WITH_RATE,
  /** The rate the visitor saw is no longer the live one (the feed moved by the time the modal opened). */
  "open-prefilled-moved-rate": { ...PREFILL, rateSnapshot: { ...RATE_SNAPSHOT, marketPriceDisplay: 99_000, ourPriceDisplay: 103_950 } },
  /** Below the 10 USDT minimum: a prefill that fails validation inside the collapsed details group. */
  "open-prefilled-small": { pairId: "USDT_BTC", amount: 1, estimatedReceive: 1 / 105_000 },
} satisfies Record<string, ExchangeRequestPrefill>;
type ProbeName = keyof typeof PREFILLS | "open-empty";

function Probe() {
  const { open } = useExchangeRequest();
  return (
    <>
      {(Object.keys(PREFILLS) as (keyof typeof PREFILLS)[]).map((name) => (
        <button key={name} type="button" onClick={() => open(PREFILLS[name])}>
          {name}
        </button>
      ))}
      <button type="button" onClick={() => open()}>
        open-empty
      </button>
    </>
  );
}

function renderHarness(locale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={locale}>
      <RuntimeConfigProvider value={RUNTIME}>
        <ExchangeRequestProvider>
          <Probe />
          <ExchangeRequestModal />
        </ExchangeRequestProvider>
      </RuntimeConfigProvider>
    </I18nProvider>,
  );
}

const F = en.exchangeRequest.fields;

/** Role-based lookups: accessible names exclude the aria-hidden required asterisk. */
function field(name: string): HTMLInputElement {
  return screen.getByRole("textbox", { name }) as HTMLInputElement;
}
/**
 * Open the modal and wait until the focus trap has moved focus inside it. The
 * trap focuses on a requestAnimationFrame; typing before that fires would let
 * the frame steal focus mid-word (a jsdom timing artefact, not a UX one).
 */
async function openWith(user: ReturnType<typeof userEvent.setup>, probe: ProbeName) {
  await user.click(screen.getByRole("button", { name: probe }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}
function openPrefilled(user: ReturnType<typeof userEvent.setup>) {
  return openWith(user, "open-prefilled");
}
function openEmpty(user: ReturnType<typeof userEvent.setup>) {
  return openWith(user, "open-empty");
}
/** Opened with a prefill the pair / amount / estimate fields sit behind "Edit details". */
async function expandDetails(user: ReturnType<typeof userEvent.setup>, label = en.exchangeRequest.editDetails) {
  await user.click(screen.getByRole("button", { name: label }));
  const pairLabel = label === en.exchangeRequest.editDetails ? F.pair.label : id.exchangeRequest.fields.pair.label;
  await screen.findByRole("combobox", { name: pairLabel });
}
/** The summary header's big line, e.g. "1,000.00 USDT → 0.00952381 BTC". */
function summaryLine(): HTMLElement {
  const title = new RegExp(`^(${en.exchangeRequest.summary.title}|${id.exchangeRequest.summary.title})$`);
  const region = screen.getByText(title).closest("section");
  if (!region) throw new Error("summary region not found");
  return within(region).getByText(/→/);
}
async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field(F.fullName.label), "Jane Doe");
  await user.type(field(F.whatsapp.label), "+62 812 3456 7890");
  await user.type(field(F.email.label), "jane@example.com");
}

/** Viewport the matchMedia stub reports; `desktop` makes `(min-width: 640px)` match. */
let viewport: "mobile" | "desktop" = "mobile";

beforeAll(() => {
  // jsdom has no matchMedia; useMediaQuery and framer's useReducedMotion probe it.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: viewport === "desktop" && query.includes("min-width: 640px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  viewport = "mobile";
  market.value = buildMarket("live");
  submitMock.mockReset();
});

afterEach(() => {
  document.body.style.overflow = "";
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("ExchangeRequestModal", () => {
  it("renders nothing until opened", () => {
    renderHarness();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with the prefill: pair, formatted amount, live estimate and the prefill note", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(en.exchangeRequest.title);
    expect(dialog).toHaveAccessibleDescription(en.exchangeRequest.subtitle);

    // The summary header carries the request; the details group is collapsed behind "Edit details".
    // 1,000 USDT at 1 BTC = 105,000 USDT (100,000 + 5 %) → 0.00952381 BTC
    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → 0.00952381 BTC");
    expect(screen.getByText(en.exchangeRequest.prefillNote)).toBeInTheDocument();
    // The rate line quotes OUR price, not the market price; the market price is the small note.
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    expect(screen.getByText("+5% FROM MARKET")).toBeInTheDocument();
    expect(screen.getByText("Market 100,000.00 USDT · our rate includes a 5% spread")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: F.pair.label })).not.toBeInTheDocument();

    await expandDetails(user);
    expect(screen.getByRole("combobox", { name: F.pair.label })).toHaveValue("USDT_BTC");
    expect(field(F.amount.label)).toHaveValue("1,000.00");
    expect(field(F.estimatedReceive.label)).toHaveValue("0.00952381");
    expect(screen.queryByRole("button", { name: en.exchangeRequest.editDetails })).not.toBeInTheDocument();
    // Never implies execution.
    const text = dialog.textContent?.toLowerCase() ?? "";
    for (const word of ["transaction successful", "convert", "order", "trade", "executed", "completed transaction"]) {
      expect(text).not.toContain(word);
    }
  });

  it("on desktop, moves focus to the first field on open; on mobile it does not pop the keyboard", async () => {
    viewport = "desktop";
    const user = userEvent.setup();
    const { unmount } = renderHarness();
    await openPrefilled(user);
    expect(field(F.fullName.label)).toHaveFocus();
    unmount();

    viewport = "mobile";
    renderHarness();
    const dialog = await openPrefilled(user);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(field(F.fullName.label)).not.toHaveFocus();
  });

  it("opens empty from the navbar path with the default pair and no prefill note", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openEmpty(user);
    await screen.findByRole("dialog");
    expect(screen.getByRole("combobox", { name: F.pair.label })).toHaveValue("USDT_BTC");
    expect(field(F.amount.label)).toHaveValue("");
    expect(field(F.estimatedReceive.label)).toHaveValue("");
    expect(screen.queryByText(en.exchangeRequest.prefillNote)).not.toBeInTheDocument();
  });

  it("recomputes the estimate and the summary as the amount changes while it has not been edited", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await expandDetails(user);

    const amount = field(F.amount.label);
    await user.clear(amount);
    expect(field(F.estimatedReceive.label)).toHaveValue("");
    expect(summaryLine()).toHaveTextContent("USDT → BTC");
    await user.type(amount, "2000");
    expect(field(F.estimatedReceive.label)).toHaveValue("0.01904762");
    expect(summaryLine()).toHaveTextContent("2,000.00 USDT → 0.01904762 BTC");
    expect(screen.getByText(/Based on the indicative rate at/)).toBeInTheDocument();
  });

  it("recomputes the estimate and the summary when the pair changes", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await expandDetails(user);

    await user.selectOptions(screen.getByRole("combobox", { name: F.pair.label }), "USDT_IDR");
    // 1,000 USDT at our rate 1 USDT = Rp16,485 / 1.05 = Rp15,700 → 15,700,000 IDR
    expect(field(F.estimatedReceive.label)).toHaveValue("15,700,000");
    expect(screen.getByText("1 USDT = Rp15,700")).toBeInTheDocument();
    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → Rp15,700,000");
  });

  it("freezes a manually edited estimate (the summary follows it) and offers to recalculate", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await expandDetails(user);

    const estimate = field(F.estimatedReceive.label);
    await user.clear(estimate);
    await user.type(estimate, "0.5");
    expect(estimate).toHaveValue("0.5");
    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → 0.50000000 BTC");
    expect(screen.getByText(en.exchangeRequest.estimateEditedNote)).toBeInTheDocument();

    const amount = field(F.amount.label);
    await user.clear(amount);
    await user.type(amount, "3000");
    expect(field(F.estimatedReceive.label)).toHaveValue("0.5"); // paused

    await user.click(screen.getByRole("button", { name: en.exchangeRequest.recalculate }));
    expect(field(F.estimatedReceive.label)).toHaveValue("0.02857143");
    expect(screen.queryByText(en.exchangeRequest.estimateEditedNote)).not.toBeInTheDocument();
  });

  it("with consent unchecked shows the consent message and never calls the API", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);

    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(screen.getByText(en.validation.consent_required)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: en.exchangeRequest.consent })).toHaveAttribute("aria-invalid", "true");
    expect(submitMock).not.toHaveBeenCalled();
    // Still on the form, not on the success screen.
    expect(screen.queryByText(en.exchangeRequest.success.title)).not.toBeInTheDocument();
  });

  it("maps every client-side validation code to its message and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openEmpty(user);
    await screen.findByRole("dialog");

    await user.type(field(F.email.label), "not-an-email");
    await user.type(field(F.amount.label), "1"); // below the 10 USDT minimum
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(screen.getAllByText(en.validation.required).length).toBeGreaterThanOrEqual(2); // fullName, whatsapp
    expect(screen.getByText(en.validation.invalid_email)).toBeInTheDocument();
    expect(screen.getByText(en.validation.amount_too_small)).toBeInTheDocument();
    expect(screen.getByText(en.validation.consent_required)).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
    // Exchange details sit above the contact fields, so the amount is the first invalid control.
    await waitFor(() => expect(field(F.amount.label)).toHaveFocus());

    // Editing a field clears its own error immediately.
    await user.type(field(F.fullName.label), "Jane");
    expect(screen.getAllByText(en.validation.required)).toHaveLength(1);
  });

  it("submits a valid request and shows the received state with the reference and WhatsApp link", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-XYZ789" });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.type(field(`${F.message.label} (${en.common.optional})`), "Please contact me after 5pm.");
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(await screen.findByText(en.exchangeRequest.success.title)).toBeInTheDocument();
    expect(screen.getByText("CX-XYZ789")).toBeInTheDocument();
    expect(screen.getByText(en.exchangeRequest.success.body)).toBeInTheDocument();

    const chat = screen.getByRole("link", { name: en.exchangeRequest.success.chat });
    expect(chat).toHaveAttribute("target", "_blank");
    expect(chat).toHaveAttribute("rel", "noopener noreferrer");
    const href = chat.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(href).toContain(encodeURIComponent("CX-XYZ789"));
    expect(href).toContain(encodeURIComponent("1,000 USDT"));

    // Summary of what was asked for, formatted with the locale.
    expect(screen.getByText("USDT → BTC")).toBeInTheDocument();
    expect(screen.getByText("1,000.00 USDT")).toBeInTheDocument();
    expect(screen.getByText("0.00952381 BTC")).toBeInTheDocument();

    // The API received the validated payload with the anti-spam meta fields.
    expect(submitMock).toHaveBeenCalledTimes(1);
    const [payload, options] = submitMock.mock.calls[0];
    expect(payload).toMatchObject({
      fullName: "Jane Doe",
      whatsapp: "+62 812 3456 7890",
      email: "jane@example.com",
      pairId: "USDT_BTC",
      amount: 1000,
      estimatedReceive: 0.00952381,
      message: "Please contact me after 5pm.",
      consent: true,
      hp: "",
    });
    expect(typeof payload.ts).toBe("number");
    expect(options).toMatchObject({ locale: "en" });
    // Success copy never claims execution.
    expect(screen.getByRole("dialog").textContent?.toLowerCase()).not.toContain("transaction successful");
  });

  it("shows a form-level alert for a rate-limited response and stays on the form", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, code: "rate_limited", retryAfterSeconds: 60 });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.form.errors.rate_limited);
    expect(screen.queryByText(en.exchangeRequest.success.title)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.exchangeRequest.submit })).toBeEnabled();
  });

  it("maps server-side field errors back onto the fields", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, code: "validation_error", errors: { email: "invalid_email" } });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(await screen.findByText(en.validation.invalid_email)).toBeInTheDocument();
    expect(field(F.email.label)).toHaveAttribute("aria-invalid", "true");
  });

  it("ignores a second submit while the first is in flight", async () => {
    const user = userEvent.setup();
    let resolve!: (value: Awaited<ReturnType<typeof submitExchangeRequest>>) => void;
    submitMock.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));

    const submit = screen.getByRole("button", { name: en.exchangeRequest.submit });
    await user.click(submit);
    // Button is busy; a programmatic form submit (Enter key path) must be a no-op too.
    expect(screen.getByRole("button", { name: en.form.submitting })).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);
    expect(submitMock).toHaveBeenCalledTimes(1);

    resolve({ ok: true, reference: "CX-ONCE01" });
    expect(await screen.findByText("CX-ONCE01")).toBeInTheDocument();
  });

  it("closes on Escape and re-opens with a fresh form after a success", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-XYZ789" });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));
    await screen.findByText(en.exchangeRequest.success.title);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 3000 });

    await openEmpty(user);
    await screen.findByRole("dialog");
    expect(screen.queryByText(en.exchangeRequest.success.title)).not.toBeInTheDocument();
    expect(field(F.fullName.label)).toHaveValue("");
    expect(field(F.amount.label)).toHaveValue("");
  });

  it("Cancel closes the dialog", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it("'Submit another request' keeps the contact details and clears the exchange details", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-XYZ789" });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));
    await screen.findByText(en.exchangeRequest.success.title);

    await user.click(screen.getByRole("button", { name: en.exchangeRequest.success.newRequest }));
    expect(field(F.fullName.label)).toHaveValue("Jane Doe");
    expect(field(F.email.label)).toHaveValue("jane@example.com");
    expect(field(F.amount.label)).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: en.exchangeRequest.consent })).not.toBeChecked();
  });

  it("when market data is unavailable (no rate snapshot): keeps the prefilled estimate, shows the notice, hides the rate", async () => {
    market.value = buildMarket("unavailable", "polling");
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");

    // The summary still says what is requested, but has no rate to quote.
    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → 0.00952381 BTC");
    expect(screen.queryByText(en.exchangeRequest.summary.rate)).not.toBeInTheDocument();
    expect(screen.queryByText(/FROM MARKET/)).not.toBeInTheDocument();
    expect(screen.getByText(en.common.marketUnavailable)).toBeInTheDocument();
    expect(screen.getByText(en.exchangeRequest.marketNote.polling)).toBeInTheDocument();

    await expandDetails(user);
    expect(field(F.estimatedReceive.label)).toHaveValue("0.00952381");
    // Summary header and estimate field both explain that the live rate is unavailable.
    expect(screen.getAllByText(en.exchangeRequest.estimateUnavailableHint)).toHaveLength(2);
    expect(screen.queryByText(/Based on the indicative rate at/)).not.toBeInTheDocument();

    // A new amount cannot be estimated, so the old prefilled estimate is dropped, never shown as current.
    await user.clear(field(F.amount.label));
    await user.type(field(F.amount.label), "2000");
    expect(field(F.estimatedReceive.label)).toHaveValue("");
    expect(summaryLine()).toHaveTextContent("2,000.00 USDT → BTC");
  });

  it("when market data is stale: still estimates but shows 'Last updated …'", async () => {
    market.value = buildMarket("stale", "reconnecting");
    const user = userEvent.setup();
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await expandDetails(user);

    expect(field(F.estimatedReceive.label)).toHaveValue("0.00952381");
    expect(screen.getByText(/^Last updated /)).toBeInTheDocument();
    expect(screen.getByText(en.exchangeRequest.marketNote.reconnecting)).toBeInTheDocument();
  });

  it("renders in Bahasa Indonesia with locale number formatting", async () => {
    const user = userEvent.setup();
    renderHarness("id");
    await openPrefilled(user);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(id.exchangeRequest.title);
    expect(screen.getByText(id.exchangeRequest.summary.title)).toBeInTheDocument();
    expect(screen.getByText("1 BTC = 105.000,00 USDT")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: id.exchangeRequest.chatWhatsApp })).toBeInTheDocument();
    await expandDetails(user, id.exchangeRequest.editDetails);
    expect(screen.getByRole("textbox", { name: id.exchangeRequest.fields.amount.label })).toHaveValue("1.000,00");
    expect(screen.getByRole("textbox", { name: id.exchangeRequest.fields.estimatedReceive.label })).toHaveValue(
      "0,00952381",
    );
    expect(within(dialog).getByRole("button", { name: id.exchangeRequest.submit })).toBeInTheDocument();
  });

  /* ───────────── summary header + collapsible details (client change 2026-09-29) ───────────── */

  it("with a rate snapshot: summary quotes the live rate, marks when it was shown, and Edit details expands the group", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openWith(user, "open-prefilled-rate");
    await screen.findByRole("dialog");

    expect(screen.getByText(en.exchangeRequest.summary.title)).toBeInTheDocument();
    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → 0.00952381 BTC");
    expect(screen.getByText(en.exchangeRequest.summary.rate)).toBeInTheDocument();
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    // Live and captured rate agree, so "Rate as shown at …" is true.
    expect(screen.getByText(/^Rate as shown at /)).toBeInTheDocument();

    // Details collapsed behind "Edit details".
    expect(screen.queryByRole("combobox", { name: F.pair.label })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: F.amount.label })).not.toBeInTheDocument();
    await expandDetails(user);
    expect(field(F.amount.label)).toHaveValue("1,000.00");

    // Editing the amount recalculates the summary estimate from the live rate.
    await user.clear(field(F.amount.label));
    await user.type(field(F.amount.label), "500");
    expect(summaryLine()).toHaveTextContent("500.00 USDT → 0.00476190 BTC");
  });

  it("drops the 'Rate as shown at' note when the live rate no longer matches the captured one", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openWith(user, "open-prefilled-moved-rate");
    await screen.findByRole("dialog");
    // Live wins over the snapshot …
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    expect(screen.queryByText("1 BTC = 103,950.00 USDT")).not.toBeInTheDocument();
    // … and the captured time would be misleading, so it is not shown.
    expect(screen.queryByText(/^Rate as shown at /)).not.toBeInTheDocument();
  });

  it("falls back to the rate snapshot when market data is unavailable", async () => {
    market.value = buildMarket("unavailable", "polling");
    const user = userEvent.setup();
    renderHarness();
    await openWith(user, "open-prefilled-rate");
    await screen.findByRole("dialog");

    expect(summaryLine()).toHaveTextContent("1,000.00 USDT → 0.00952381 BTC");
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    expect(screen.getByText("+5% FROM MARKET")).toBeInTheDocument();
    expect(screen.getByText(/^Rate as shown at /)).toBeInTheDocument();
    expect(screen.getByText(en.common.marketUnavailable)).toBeInTheDocument();
    // The snapshot belongs to the prefilled pair: a pair change must not carry it over.
    await expandDetails(user);
    await user.selectOptions(screen.getByRole("combobox", { name: F.pair.label }), "USDT_IDR");
    expect(screen.queryByText("1 BTC = 105,000.00 USDT")).not.toBeInTheDocument();
    expect(screen.queryByText(/FROM MARKET/)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.exchangeRequest.estimateUnavailableHint).length).toBeGreaterThanOrEqual(1);
  });

  it("footer: WhatsApp CTA carries the CURRENT pair and amount, submit and cancel stay", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openWith(user, "open-prefilled-rate");
    const dialog = await screen.findByRole("dialog");

    const chat = within(dialog).getByRole("link", { name: en.exchangeRequest.chatWhatsApp });
    expect(chat).toHaveAttribute("target", "_blank");
    expect(chat).toHaveAttribute("rel", "noopener noreferrer");
    let href = chat.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(href).toContain(encodeURIComponent("USDT → BTC"));
    expect(href).toContain(encodeURIComponent("1,000 USDT"));
    expect(href).toContain(encodeURIComponent("0.00952381 BTC"));
    expect(within(dialog).getByRole("button", { name: en.exchangeRequest.submit })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: en.exchangeRequest.cancel })).toBeInTheDocument();

    // Follows edits: a new amount and pair show up in the link.
    await expandDetails(user);
    await user.selectOptions(screen.getByRole("combobox", { name: F.pair.label }), "USDT_IDR");
    await user.clear(field(F.amount.label));
    await user.type(field(F.amount.label), "250");
    href = within(dialog).getByRole("link", { name: en.exchangeRequest.chatWhatsApp }).getAttribute("href") ?? "";
    expect(href).toContain(encodeURIComponent("USDT → IDR"));
    expect(href).toContain(encodeURIComponent("250 USDT"));
    expect(href).not.toContain(encodeURIComponent("1,000 USDT"));
  });

  it("opened without a prefill: details expanded, no Edit details button, summary reflects the defaults", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openEmpty(user);
    await screen.findByRole("dialog");

    expect(screen.getByRole("combobox", { name: F.pair.label })).toHaveValue("USDT_BTC");
    expect(field(F.amount.label)).toHaveValue("");
    expect(screen.queryByRole("button", { name: en.exchangeRequest.editDetails })).not.toBeInTheDocument();
    expect(summaryLine()).toHaveTextContent("USDT → BTC");
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    expect(screen.queryByText(en.exchangeRequest.prefillNote)).not.toBeInTheDocument();
    // No amount yet: the WhatsApp CTA opens a general inquiry rather than "Amount: —".
    const href = screen.getByRole("link", { name: en.exchangeRequest.chatWhatsApp }).getAttribute("href") ?? "";
    expect(href).toBe(buildWhatsAppUrl(buildGeneralInquiryMessage("en"), RUNTIME.whatsappNumber));
    expect(href).not.toContain(encodeURIComponent("USDT → BTC"));
  });

  it("a validation error inside the collapsed details group expands it and focuses the field", async () => {
    const user = userEvent.setup();
    renderHarness();
    await openWith(user, "open-prefilled-small");
    await screen.findByRole("dialog");
    expect(screen.queryByRole("textbox", { name: F.amount.label })).not.toBeInTheDocument();

    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(screen.getByText(en.validation.amount_too_small)).toBeInTheDocument();
    const amount = field(F.amount.label);
    expect(amount).toHaveValue("1.00");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(amount).toHaveFocus());
    expect(screen.queryByRole("button", { name: en.exchangeRequest.editDetails })).not.toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("a server-side error on a details field expands the collapsed group too", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, code: "validation_error", errors: { amount: "amount_too_large" } });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(await screen.findByText(en.validation.amount_too_large)).toBeInTheDocument();
    expect(field(F.amount.label)).toHaveAttribute("aria-invalid", "true");
  });

  it("submits an IDR estimate exactly as displayed (grouped integers never go through the ambiguous parser)", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-IDR001" });
    renderHarness();
    await openPrefilled(user);
    await screen.findByRole("dialog");
    await expandDetails(user);
    await user.selectOptions(screen.getByRole("combobox", { name: F.pair.label }), "USDT_IDR");
    expect(field(F.estimatedReceive.label)).toHaveValue("15,700,000");
    await fillContact(user);
    await user.click(screen.getByRole("checkbox", { name: en.exchangeRequest.consent }));
    await user.click(screen.getByRole("button", { name: en.exchangeRequest.submit }));

    expect(await screen.findByText("CX-IDR001")).toBeInTheDocument();
    const [payload] = submitMock.mock.calls[0];
    expect(payload).toMatchObject({ pairId: "USDT_IDR", amount: 1000, estimatedReceive: 15_700_000 });
    expect(screen.getByText("Rp15,700,000")).toBeInTheDocument();
  });

  it("shows the summary header in Bahasa Indonesia", async () => {
    const user = userEvent.setup();
    renderHarness("id");
    await openWith(user, "open-prefilled-rate");
    await screen.findByRole("dialog");
    expect(screen.getByText("Anda mengajukan")).toBeInTheDocument();
    expect(screen.getByText(id.exchangeRequest.summary.rate)).toBeInTheDocument();
    expect(summaryLine()).toHaveTextContent("1.000,00 USDT → 0,00952381 BTC");
    expect(screen.getByText("Pasar 100.000,00 USDT · kurs kami sudah termasuk spread 5%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: id.exchangeRequest.editDetails })).toBeInTheDocument();
  });
});
