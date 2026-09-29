import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Contact } from "@/components/sections/Contact";
import { submitContact, type SubmitResult } from "@/lib/api/client";
import { interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/api/client", () => ({ submitContact: vi.fn() }));
const submitMock = vi.mocked(submitContact);

/**
 * `siteConfig` reads NEXT_PUBLIC_* at import time. A Proxy lets each test
 * decide whether WhatsApp / email are configured without touching the env.
 */
const siteState = vi.hoisted(() => ({ whatsappNumber: "", contactEmail: "" }));
vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  const siteConfig = new Proxy(actual.siteConfig, {
    get(target, prop, receiver) {
      if (prop === "whatsappNumber") return siteState.whatsappNumber;
      if (prop === "contactEmail") return siteState.contactEmail;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { ...actual, siteConfig };
});

/** jsdom has no IntersectionObserver; framer's `whileInView` needs one. Everything is "in view". */
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const entry = { isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  submitMock.mockReset();
  siteState.whatsappNumber = "";
  siteState.contactEmail = "";
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderContact(locale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={locale}>
      <Contact />
    </I18nProvider>,
  );
}

const field = (label: string) => screen.getByRole("textbox", { name: label });
const submitButton = () => screen.getByRole("button", { name: en.contact.submit });

const VALID = {
  name: "Jane Doe",
  email: "jane@example.com",
  whatsapp: "+62 812 3456 7890",
  subject: "Question about USDT to BTC",
  message: "I would like to know the current process for a larger exchange.",
};

async function fillValid(user: UserEvent, overrides: Partial<typeof VALID> = {}) {
  const values = { ...VALID, ...overrides };
  const f = en.contact.fields;
  if (values.name) await user.type(field(f.name.label), values.name);
  if (values.email) await user.type(field(f.email.label), values.email);
  if (values.whatsapp) await user.type(field(f.whatsapp.label), values.whatsapp);
  if (values.subject) await user.type(field(f.subject.label), values.subject);
  if (values.message) await user.type(field(f.message.label), values.message);
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Contact section", () => {
  it("renders the #contact section with one h2 and the direct-contact card", () => {
    renderContact();
    const section = document.getElementById("contact");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const headings = within(section as HTMLElement).getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.contact.title);
    expect(section).toHaveAttribute("aria-labelledby", headings[0].id);
    expect(screen.getByText(en.contact.directTitle)).toBeInTheDocument();
    expect(screen.getByText(en.contact.responseTime)).toBeInTheDocument();
    expect(screen.getByText(en.contact.privacyNote)).toBeInTheDocument();
  });

  it("shows the not-configured note and no email row when nothing is configured", () => {
    renderContact();
    expect(screen.getByText(en.whatsapp.notConfigured)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.contact.whatsappLabel })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("links WhatsApp (general message, new tab) and the email address when configured", () => {
    siteState.whatsappNumber = "6281234567890";
    siteState.contactEmail = "desk@example.com";
    renderContact();

    const whatsapp = screen.getByRole("link", { name: en.contact.whatsappLabel });
    const href = whatsapp.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain(interpolate(en.whatsapp.generalInquiry, { brand: "Cryptix" }));
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText(en.whatsapp.notConfigured)).not.toBeInTheDocument();

    const email = screen.getByRole("link", { name: "desk@example.com" });
    expect(email).toHaveAttribute("href", "mailto:desk@example.com");
  });

  it("renders Indonesian labels in the id locale", () => {
    renderContact("id");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(id.contact.title);
    expect(screen.getByRole("textbox", { name: id.contact.fields.name.label })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: id.contact.fields.whatsapp.label })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: id.contact.fields.message.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: id.contact.submit })).toBeInTheDocument();
    expect(screen.getByText(id.contact.directTitle)).toBeInTheDocument();
    // Precondition for the assertions above to mean anything.
    expect(id.contact.fields.name.label).not.toBe(en.contact.fields.name.label);
  });
});

describe("Contact form", () => {
  it("has labelled, bounded inputs and an off-screen honeypot", () => {
    renderContact();
    const f = en.contact.fields;
    expect(field(f.name.label)).toHaveAttribute("maxlength", "80");
    expect(field(f.email.label)).toHaveAttribute("type", "email");
    expect(field(f.whatsapp.label)).toHaveAttribute("inputmode", "tel");
    expect(field(f.subject.label)).toHaveAttribute("maxlength", "120");
    expect(field(f.message.label)).toHaveAttribute("maxlength", "2000");

    const honeypot = document.querySelector<HTMLInputElement>('input[name="company"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    // Hidden from assistive tech: not among the accessible textboxes.
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
  });

  it("submitting an empty form shows the required message on every field and does not call the API", async () => {
    const user = userEvent.setup();
    renderContact();

    await user.click(submitButton());

    expect(screen.getAllByText(en.validation.required)).toHaveLength(5);
    expect(submitMock).not.toHaveBeenCalled();
    expect(field(en.contact.fields.name.label)).toHaveFocus();
    expect(field(en.contact.fields.name.label)).toHaveAttribute("aria-invalid", "true");
  });

  it("flags an invalid email and focuses it without calling the API", async () => {
    const user = userEvent.setup();
    renderContact();

    await fillValid(user, { email: "not-an-email" });
    await user.click(submitButton());

    expect(screen.getByText(en.validation.invalid_email)).toBeInTheDocument();
    expect(screen.queryByText(en.validation.required)).not.toBeInTheDocument();
    expect(field(en.contact.fields.email.label)).toHaveFocus();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("clears a field's error once the visitor edits that field", async () => {
    const user = userEvent.setup();
    renderContact();
    await user.click(submitButton());
    expect(screen.getAllByText(en.validation.required)).toHaveLength(5);

    await user.type(field(en.contact.fields.name.label), "J");

    expect(screen.getAllByText(en.validation.required)).toHaveLength(4);
    expect(field(en.contact.fields.name.label)).not.toHaveAttribute("aria-invalid");
  });

  it("sends the fields with hp and ts, then shows the success state with the reference", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-ABC123" });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByText(en.contact.success.title)).toBeInTheDocument();
    expect(screen.getByText(interpolate(en.contact.success.reference, { reference: "CX-ABC123" }))).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: en.contact.success.title })).toHaveFocus();
    // The form is gone; the reset action is offered.
    expect(screen.queryByRole("button", { name: en.contact.submit })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.contact.success.another })).toBeInTheDocument();

    expect(submitMock).toHaveBeenCalledTimes(1);
    const [payload, options] = submitMock.mock.calls[0];
    expect(payload).toEqual({ ...VALID, hp: "", ts: expect.any(Number) });
    expect(options).toMatchObject({ locale: "en" });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes a filled honeypot through as hp instead of blocking client-side", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-BOT001" });
    renderContact();

    await fillValid(user);
    const honeypot = document.querySelector<HTMLInputElement>('input[name="company"]');
    fireEvent.change(honeypot as HTMLInputElement, { target: { value: "Acme Bots Ltd" } });
    await user.click(submitButton());

    expect(await screen.findByText(en.contact.success.title)).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock.mock.calls[0][0]).toMatchObject({ hp: "Acme Bots Ltd" });
  });

  it("shows the rate-limited message with the retry delay in a form-level alert", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: false, code: "rate_limited", retryAfterSeconds: 60 });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());

    const message = await screen.findByText(en.form.errors.rate_limited);
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByText(interpolate(en.contact.retryAfter, { seconds: "60" }))).toBeInTheDocument();
    // Back to an editable form, values preserved.
    expect(submitButton()).toBeEnabled();
    expect(field(en.contact.fields.name.label)).toHaveValue(VALID.name);
    expect(screen.queryByText(en.contact.success.title)).not.toBeInTheDocument();
  });

  it("shows delivery_failed and network_error copy from t.form.errors", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValueOnce({ ok: false, code: "delivery_failed" });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByText(en.form.errors.delivery_failed)).toBeInTheDocument();

    submitMock.mockResolvedValueOnce({ ok: false, code: "network_error" });
    await user.click(submitButton());
    expect(await screen.findByText(en.form.errors.network_error)).toBeInTheDocument();
    expect(screen.queryByText(en.form.errors.delivery_failed)).not.toBeInTheDocument();
  });

  it("maps server-side validation errors onto the fields and ignores unknown keys", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      ok: false,
      code: "validation_error",
      errors: { email: "invalid_email", subject: "too_long", bogus: "required" },
    });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByText(en.validation.invalid_email)).toBeInTheDocument();
    expect(screen.getByText(en.validation.too_long)).toBeInTheDocument();
    expect(screen.queryByText(en.validation.required)).not.toBeInTheDocument();
    expect(field(en.contact.fields.email.label)).toHaveFocus();
    // Field errors are <p role="alert">; the form-level alert is the only <div role="alert">.
    expect(document.querySelector('form div[role="alert"]')).toBeNull();
    expect(screen.queryByText(en.form.errors.unknown)).not.toBeInTheDocument();
  });

  it("ignores a second submit while the first request is pending (ref guard, not state)", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (result: SubmitResult) => void = () => {};
    submitMock.mockImplementation(
      () =>
        new Promise<SubmitResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderContact();
    await fillValid(user);

    const form = screen.getByRole("form", { name: en.contact.formTitle });
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(submitMock).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole("button", { name: en.form.submitting });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toBeDisabled();

    await act(async () => {
      resolveSubmit({ ok: true, reference: "CX-ONCE01" });
    });
    expect(await screen.findByText(en.contact.success.title)).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("offers a WhatsApp link carrying the reference on success when configured", async () => {
    siteState.whatsappNumber = "6281234567890";
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-REF999" });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText(en.contact.success.title);

    const chat = screen.getByRole("link", { name: en.contact.success.chat });
    const href = decodeURIComponent(chat.getAttribute("href") ?? "");
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(href).toContain(interpolate(en.contact.success.reference, { reference: "CX-REF999" }));
    expect(chat).toHaveAttribute("target", "_blank");
  });

  it("hides the WhatsApp link on success when WhatsApp is not configured", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-REF000" });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText(en.contact.success.title);

    expect(screen.queryByRole("link", { name: en.contact.success.chat })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.contact.success.another })).toBeInTheDocument();
  });

  it("'Send another message' returns to an empty form", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-AGAIN1" });
    renderContact();

    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText(en.contact.success.title);

    await user.click(screen.getByRole("button", { name: en.contact.success.another }));

    expect(screen.queryByText(en.contact.success.title)).not.toBeInTheDocument();
    expect(field(en.contact.fields.name.label)).toHaveValue("");
    expect(field(en.contact.fields.message.label)).toHaveValue("");
    expect(screen.queryByText(en.validation.required)).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("never uses the forbidden 'transaction successful' wording anywhere in the section", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ok: true, reference: "CX-COPY01" });
    const { container } = renderContact();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByText(en.contact.success.title);
    expect(container.textContent?.toLowerCase()).not.toContain("transaction successful");
  });
});
