import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher, type LanguageSwitcherVariant } from "@/components/layout/LanguageSwitcher";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n/types";

/** Reads the active dictionary so the test observes the provider, not the button. */
function Probe() {
  const { t, locale } = useI18n();
  return (
    <span data-testid="probe" data-locale={locale}>
      {t.nav.exchange}
    </span>
  );
}

function renderSwitcher(variant: LanguageSwitcherVariant = "navbar", initialLocale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <LanguageSwitcher variant={variant} />
      <Probe />
    </I18nProvider>,
  );
}

beforeEach(() => {
  // The provider persists the choice; start every test from a clean cookie.
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

describe("LanguageSwitcher", () => {
  it("has distinct English and Indonesian labels for the probe key", () => {
    // Precondition: the assertion below would be vacuous if these were equal.
    expect(en.nav.exchange).not.toBe(id.nav.exchange);
  });

  it("renders a labelled group with one pressed button per locale (navbar)", () => {
    renderSwitcher("navbar");
    const group = screen.getByRole("group", { name: en.nav.language });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("lang", "en");
    expect(buttons[0]).toHaveTextContent(LOCALE_LABELS.en.short);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[1]).toHaveAttribute("lang", "id");
    expect(buttons[1]).toHaveTextContent(LOCALE_LABELS.id.short);
  });

  it("switches the provider locale when ID is clicked", async () => {
    const user = userEvent.setup();
    renderSwitcher("navbar");
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveTextContent(en.nav.exchange);
    expect(probe).toHaveAttribute("data-locale", "en");

    await user.click(screen.getByRole("button", { name: LOCALE_LABELS.id.long }));

    expect(probe).toHaveTextContent(id.nav.exchange);
    expect(probe).toHaveAttribute("data-locale", "id");
    // The group label re-renders in the new language and aria-pressed flips.
    const group = screen.getByRole("group", { name: id.nav.language });
    const buttons = within(group).getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    // Side effects owned by the provider: <html lang> and the cookie.
    expect(document.documentElement.lang).toBe("id");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=id`);
  });

  it("switches back to English from an Indonesian start", async () => {
    const user = userEvent.setup();
    renderSwitcher("footer", "id");
    expect(screen.getByTestId("probe")).toHaveTextContent(id.nav.exchange);

    await user.click(screen.getByRole("button", { name: LOCALE_LABELS.en.long }));

    expect(screen.getByTestId("probe")).toHaveTextContent(en.nav.exchange);
  });

  it("is keyboard operable: arrow keys move focus, Enter activates", async () => {
    const user = userEvent.setup();
    renderSwitcher("navbar");
    const [enButton, idButton] = screen.getAllByRole("button");

    await user.tab();
    expect(enButton).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(idButton).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByTestId("probe")).toHaveTextContent(id.nav.exchange);

    await user.keyboard("{ArrowLeft}");
    expect(enButton).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByTestId("probe")).toHaveTextContent(en.nav.exchange);
  });

  it("renders full language names in the footer variant", () => {
    renderSwitcher("footer");
    expect(screen.getByRole("button", { name: LOCALE_LABELS.en.long })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LOCALE_LABELS.id.long })).toBeInTheDocument();
  });

  it("renders two full-width buttons in the mobile variant", () => {
    renderSwitcher("mobile");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.className).toContain("w-full");
    }
    expect(buttons[1]).toHaveTextContent(LOCALE_LABELS.id.long);
  });

  it("does not re-persist when the active locale is clicked again", async () => {
    const user = userEvent.setup();
    renderSwitcher("navbar");
    await user.click(screen.getByRole("button", { name: LOCALE_LABELS.en.long }));
    expect(screen.getByTestId("probe")).toHaveTextContent(en.nav.exchange);
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=en`);
  });
});
